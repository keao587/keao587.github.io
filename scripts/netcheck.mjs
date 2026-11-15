#!/usr/bin/env node
/**
 * 网络体检 —— 分清「链路问题 / 代理问题 / 权限问题」
 *
 * 为什么不用 curl：curl 走 Windows 的 schannel、读系统证书容器，
 * 在权限受限的环境里连本地主机都连不上，会把「权限问题」误报成「网络问题」。
 * 这个脚本用 Node 自己的 TLS 栈，不读系统代理，是干净的网络基线。
 *
 * 用法：node scripts/netcheck.mjs
 * 退出码：0 = 一切正常；1 = 有目标连不上
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** 要体检的站点 */
const TARGETS = [
  { host: 'github.com', label: 'GitHub 主站', https: true },
  { host: 'api.github.com', label: 'GitHub API', https: true },
  { host: 'keao587.github.io', label: '我的站点', https: true },
  { host: 'registry.npmmirror.com', label: 'npm 镜像', https: false },
];

/** 绕开域名，直接验证出口能不能出去 */
const BARE_IPS = [
  { ip: '223.5.5.5', family: 4, label: '阿里 DNS（国内对照）' },
  { ip: '1.1.1.1', family: 4, label: 'Cloudflare DNS（境外）' },
  { ip: '8.8.8.8', family: 4, label: 'Google DNS（境外）' },
];

const TIMEOUT = 6000;
const LABEL_WIDTH = 22;

// 只有真终端才上色；管道/重定向时不输出转义码
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const ok = paint(32);
const bad = paint(31);
const warn = paint(33);
const dim = paint(2);

/** 中文占两个字符宽，padEnd 会算错，自己按显示宽度补 */
function displayWidth(s) {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    const wide =
      cp >= 0x1100 &&
      (cp <= 0x115f ||
        cp === 0x2329 ||
        cp === 0x232a ||
        (cp >= 0x2e80 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe30 && cp <= 0xfe6f) ||
        (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x20000 && cp <= 0x3fffd));
    w += wide ? 2 : 1;
  }
  return w;
}

function pad(s, width = LABEL_WIDTH) {
  const diff = width - displayWidth(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
}

function section(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(56));
}

function tcpConnect(host, port, family) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host, port, family });
    const done = (success, note = '') => {
      socket.destroy();
      resolve({ success, ms: Date.now() - started, note });
    };
    socket.setTimeout(TIMEOUT);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false, '超时'));
    socket.once('error', (e) => done(false, e.code || e.message));
  });
}

async function tryExec(cmd, args) {
  try {
    const { stdout } = await run(cmd, args, { timeout: 4000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

// ── ① 环境与代理 ─────────────────────────────────────────
section('① 环境与代理设置');

console.log(`${pad('平台')}${process.platform} / Node ${process.version}`);

const envProxy = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy']
  .filter((k) => process.env[k])
  .map((k) => `${k}=${process.env[k]}`);
console.log(`${pad('环境变量代理')}${envProxy.length ? envProxy.join('  ') : dim('无')}`);

const gitProxy =
  (await tryExec('git', ['config', '--global', '--get', 'http.proxy'])) ||
  (await tryExec('git', ['config', '--global', '--get', 'https.proxy']));
console.log(`${pad('git 代理')}${gitProxy || dim('无（直连）')}`);

let systemProxyOn = false;
if (process.platform === 'win32') {
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  const raw = await tryExec('reg', ['query', key]);
  const enable = raw.match(/ProxyEnable\s+REG_DWORD\s+0x(\d+)/i);
  const server = raw.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
  systemProxyOn = enable ? parseInt(enable[1], 16) === 1 : false;

  console.log(
    `${pad('系统代理')}` +
      (systemProxyOn ? warn('已开启') : ok('已关闭')) +
      (server ? `  服务器=${server[1].trim()}` : '')
  );

  if (!systemProxyOn && server) {
    console.log(dim(`${' '.repeat(LABEL_WIDTH)}注意：代理已关，但有残留地址，某些程序可能被它误导`));
  }
} else {
  console.log(`${pad('系统代理')}${dim('非 Windows，跳过注册表检查')}`);
}

// ── ② DNS ───────────────────────────────────────────────
section('② DNS 解析');

const resolved = new Map();

for (const t of TARGETS) {
  try {
    const addrs = await dns.lookup(t.host, { all: true });
    const v4 = addrs.filter((a) => a.family === 4).map((a) => a.address);
    const v6 = addrs.filter((a) => a.family === 6).map((a) => a.address);
    resolved.set(t.host, { v4, v6 });
    console.log(
      `${pad(t.label)}A: ${pad(v4[0] || dim('无'), 18)}AAAA: ${v6[0] || dim('无')}`
    );
  } catch (e) {
    console.log(`${pad(t.label)}${bad('解析失败')} ${e.code || e.message}`);
    resolved.set(t.host, { v4: [], v6: [] });
  }
}

// ── ③ TCP 建连 ───────────────────────────────────────────
section('③ TCP 443 建连');

let v4Ok = 0;
let v4Total = 0;

for (const t of TARGETS) {
  const { v4, v6 } = resolved.get(t.host) || { v4: [], v6: [] };

  if (v4[0]) {
    v4Total++;
    const r = await tcpConnect(v4[0], 443, 4);
    if (r.success) v4Ok++;
    const mark = r.success ? ok(`OK   ${String(r.ms).padStart(4)}ms`) : bad(`FAIL ${r.note}`);
    console.log(`${pad(t.label)}IPv4 ${mark}`);
  } else {
    console.log(`${pad(t.label)}IPv4 ${dim('无 A 记录，跳过')}`);
  }

  if (v6[0]) {
    const r = await tcpConnect(v6[0], 443, 6);
    const mark = r.success ? ok(`OK   ${String(r.ms).padStart(4)}ms`) : bad(`FAIL ${r.note}`);
    console.log(`${' '.repeat(LABEL_WIDTH)}IPv6 ${mark}`);
  }
}

// ── ④ HTTPS 实际请求 ─────────────────────────────────────
section('④ HTTPS 请求');

let httpsOk = 0;
let httpsTotal = 0;

for (const t of TARGETS.filter((x) => x.https)) {
  httpsTotal++;
  try {
    const started = Date.now();
    const res = await fetch(`https://${t.host}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(20000),
    });
    httpsOk++;
    console.log(
      `${pad(t.label)}${ok(String(res.status))} ${String(Date.now() - started).padStart(5)}ms`
    );
  } catch (e) {
    console.log(`${pad(t.label)}${bad('FAIL')} ${e.cause?.code || e.name || e.message}`);
  }
}

// ── ⑤ 出口连通性 ─────────────────────────────────────────
section('⑤ 出口连通性（绕开 DNS）');

for (const b of BARE_IPS) {
  const r = await tcpConnect(b.ip, 443, b.family);
  const mark = r.success ? ok(`OK   ${String(r.ms).padStart(4)}ms`) : bad(`FAIL ${r.note}`);
  console.log(`${pad(b.label)}${mark}`);
}

// ── ⑥ 结论 ───────────────────────────────────────────────
section('结论');

const v4Ratio = v4Total ? v4Ok / v4Total : 0;
const allGood = v4Ratio === 1 && httpsOk === httpsTotal;

if (allGood) {
  console.log(ok('✓ 全部正常，网络不是问题'));
} else if (v4Ratio >= 0.5) {
  console.log(warn('△ 部分目标失败 —— 属于「间歇性干扰」，不是你的配置错了'));
  console.log(dim('  典型特征：TCP 能连上但 HTTPS 被重置，重试几次就能过'));
} else {
  console.log(bad('✗ 大部分目标连不上'));
  if (systemProxyOn) {
    console.log(warn('  系统代理是开着的 —— 先关掉它再测一次，很可能就好了'));
  }
}

if (systemProxyOn) {
  console.log(
    dim('  提示：系统代理开着时 PowerShell / 安装器 / Edge 走代理，')
  );
  console.log(dim('        curl / git / node 默认直连，两者的结果会不一致。'));
}

const ghOk = v4Ok > 0 && httpsOk > 0;
process.exitCode = allGood ? 0 : ghOk ? 1 : 2;
