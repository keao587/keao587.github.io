/**
 * 用 Edge/Chrome 的 DevTools 协议截图，可精确指定视口宽度。
 * 比 --screenshot 靠谱：能模拟移动端，还能顺便检出横向溢出。
 *
 * 用法：
 *   node scripts/shot.mjs <url> <width> <out.png> [height]
 */

import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const BROWSERS = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
];

const browser = BROWSERS.find((p) => p && existsSync(p));
if (!browser) {
  console.error('没找到 Edge 或 Chrome');
  process.exit(1);
}

const [, , urlArg, widthArg, outArg, heightArg] = process.argv;
if (!urlArg || !widthArg || !outArg) {
  console.error('用法: node scripts/shot.mjs <url> <width> <out.png> [height]');
  process.exit(1);
}

const width = Number(widthArg);
const outPath = resolve(outArg);
const port = 9333 + Math.floor(Math.random() * 400);

const profile = `${tmpdir()}\\shot-profile-${port}`;
const child = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore', detached: false }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* 还没起来 */
    }
    await sleep(100);
  }
  throw new Error('DevTools 端口没起来');
}

function connect(wsUrl) {
  return new Promise((resolveP, rejectP) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolveP(ws));
    ws.addEventListener('error', () => rejectP(new Error('WebSocket 连接失败')));
  });
}

function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  const events = new Map();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
      return;
    }
    if (msg.method && events.has(msg.method)) {
      events.get(msg.method).forEach((fn) => fn(msg.params));
      events.delete(msg.method);
    }
  });

  const send = (method, params = {}) =>
    new Promise((res, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve: res, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const once = (method) =>
    new Promise((res) => {
      if (!events.has(method)) events.set(method, []);
      events.get(method).push(res);
    });

  return { send, once };
}

try {
  await waitForDevtools();

  const targetRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = await targetRes.json();
  const ws = await connect(target.webSocketDebuggerUrl);
  const { send, once } = makeClient(ws);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: Number(heightArg) || 900,
    deviceScaleFactor: 1,
    mobile: width < 800,
  });

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: urlArg });
  await loaded;
  await sleep(900);

  // 真实内容高度 + 横向溢出检查
  const { result } = await send('Runtime.evaluate', {
    expression: `(() => {
      const doc = document.documentElement;
      const vw = window.innerWidth;
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          bad.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && el.className.toString().slice(0, 60)) || '',
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
        }
      }
      return JSON.stringify({
        innerWidth: vw,
        scrollWidth: doc.scrollWidth,
        scrollHeight: doc.scrollHeight,
        overflow: bad.slice(0, 12),
        overflowCount: bad.length,
      });
    })()`,
    returnByValue: true,
  });

  const report = JSON.parse(result.value);
  const fullHeight = Math.min(report.scrollHeight + 40, 20000);

  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: fullHeight,
    deviceScaleFactor: 1,
    mobile: width < 800,
  });
  await sleep(500);

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(shot.data, 'base64'));

  console.log(
    `saved ${outPath}\n  viewport=${report.innerWidth} scrollWidth=${report.scrollWidth} height=${report.scrollHeight}`
  );
  if (report.overflowCount) {
    console.log(`  ⚠ ${report.overflowCount} 个元素超出视口:`);
    for (const o of report.overflow) {
      console.log(`    ${o.tag}.${o.cls}  [${o.left} → ${o.right}]`);
    }
  }

  ws.close();
} catch (err) {
  console.error('截图失败:', err.message);
  process.exitCode = 1;
} finally {
  child.kill();
}
