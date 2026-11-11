import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ---------------------------------------------------------------------------
// 部署地址解析
// 本地构建：默认 https://example.github.io
// GitHub Actions：自动从 GITHUB_REPOSITORY 推导
//   - 仓库名是 <用户名>.github.io  -> 站点根路径，base 为 "/"
//   - 其他仓库名                    -> 项目页，base 为 "/<仓库名>"
// 也可以手动指定：SITE_URL=https://你的域名 BASE_PATH=/
// ---------------------------------------------------------------------------
function resolveSite() {
  if (process.env.SITE_URL) {
    return {
      site: process.env.SITE_URL,
      base: process.env.BASE_PATH || '/',
    };
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (repo && repo.includes('/')) {
    const [owner, name] = repo.split('/');
    const ownerLc = owner.toLowerCase();
    const isRootSite = name.toLowerCase() === `${ownerLc}.github.io`;
    return {
      site: `https://${ownerLc}.github.io`,
      base: isRootSite ? '/' : `/${name}`,
    };
  }

  return { site: 'https://example.github.io', base: '/' };
}

const { site, base } = resolveSite();

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
});
