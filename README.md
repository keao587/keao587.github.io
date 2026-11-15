# 个人网站

**线上地址：https://keao587.github.io/**

Astro 静态站，部署在 GitHub Pages。改内容不用碰代码：作品和实验都是 Markdown 文件。

## 怎么更新线上内容

改完内容后：

```bash
pnpm build          # 先本地确认能构建
git add -A
git commit -m "加了一个作品"
git push
```

推送后 GitHub Actions 会自动构建并发布，大约 1 分钟生效。

## 本地开发

```bash
pnpm install     # 第一次
pnpm dev         # 开发服务器 http://localhost:4321
pnpm build       # 构建到 dist/
pnpm preview     # 预览构建结果
pnpm netcheck    # 网络体检：分清是链路、代理还是权限的问题
```

### 网络体检

推不上去、`git` 老超时、或者 `curl` 报一堆连不上的时候，先跑：

```bash
pnpm netcheck
```

它会打印代理状态、DNS 解析、TCP 建连耗时、HTTPS 实际响应，以及绕开 DNS 的裸 IP 出口测试。
用的是 Node 自己的 TLS 栈，不受 Windows 系统代理和 schannel 影响，所以比 `curl` 更适合做基准判断。

退出码：`0` 全通，`1` 部分目标失败（间歇性干扰），`2` 大面积不通。

## 怎么加东西

### 加一个作品

在 `src/content/works/` 新建一个 `.md`，文件名就是网址：

```md
---
title: 作品名
summary: 一句话说明，会显示在卡片上
year: '2026'
role: 设计 / 开发
tags: [Astro, 设计]
featured: true      # 是否出现在首页
order: 1            # 越小越靠前
---

正文用 Markdown 写。
```

### 加一个实验

在 `src/content/lab/` 新建 `.md`：

```md
---
title: 实验名
summary: 一句话说明
status: idea        # live 已上线 / building 进行中 / idea 想法
year: '2026'
tags: [动效]
order: 5
---
```

### 改名字、简介、联系方式

全部在 `src/config.ts` 里。

## 部署

推到 `main` 分支，GitHub Actions 自动构建并发布（见 `.github/workflows/deploy.yml`）。

站点地址由仓库名决定：

- 仓库叫 `<用户名>.github.io` → `https://<用户名>.github.io/`
- 其他仓库名 → `https://<用户名>.github.io/<仓库名>/`，构建时 base 会自动加上

`astro.config.mjs` 会自动从 `GITHUB_REPOSITORY` 推导地址，不用手动改。绑自定义域名时，设置环境变量 `SITE_URL` 和 `BASE_PATH` 即可。

## 目录结构

```
src/
  config.ts              站点配置（名字、邮箱、导航）
  content/
    works/*.md           作品
    lab/*.md             实验
  layouts/Base.astro     全局布局 + 明暗主题
  components/            导航、页脚、卡片
  pages/
    index.astro          首页
    works/               作品列表 + 详情
    lab/                 实验室列表 + 详情
  styles/global.css      所有样式
scripts/shot.mjs         本地截图工具（调视口宽度、查横向溢出）
```

## 待办

- [ ] 换成自己的域名
- [ ] 补 og 分享图（`public/og.png`，在 `Base.astro` 里加 `og:image`）
- [ ] 把示例作品和实验替换成真实内容
