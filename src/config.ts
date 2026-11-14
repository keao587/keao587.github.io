/**
 * 站点全局配置 —— 想改名字、简介、链接，基本只需要动这个文件。
 */

export const SITE = {
  /** 站点名字，会出现在浏览器标签、导航、页脚 */
  name: 'keao',
  /** 一句话身份，例如「设计师」「开发者」「随便什么」 */
  role: '设计 × 代码',
  /** 首页大标题下面那句话 */
  tagline: '把脑子里的想法，做成能跑起来的东西。',
  /** SEO 描述 */
  description:
    'keao 的个人网站：作品集、创意实验，以及一些还没想清楚但很想做的东西。',

  /** 联系方式（换成你自己的邮箱，公共网站会被人看到） */
  email: 'hello@example.com',
  /** 社交链接，不需要的删掉即可 */
  socials: [
    { label: 'GitHub', href: 'https://github.com/' },
    { label: '即刻', href: 'https://web.okjike.com/' },
    { label: '小红书', href: 'https://www.xiaohongshu.com/' },
  ],
  location: '中国',
} as const;

/** 首页「现在」面板里列的东西 */
export const NOW = [
  { label: '在做', value: '给这个站点慢慢加东西' },
  { label: '在学', value: '动效与排版' },
  { label: '状态', value: '乐于接洽合作' },
] as const;

/** 顶部导航 */
export const NAV = [
  { label: '作品', href: '/works/' },
  { label: '实验室', href: '/lab/' },
  { label: '关于', href: '/#about' },
] as const;
