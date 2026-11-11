/**
 * 统一处理站内链接前缀。
 *
 * GitHub Pages 有两种形态：
 *   - 用户站点   https://name.github.io/        -> base = "/"
 *   - 项目站点   https://name.github.io/repo/   -> base = "/repo/"
 *
 * 用这个函数包一层，换仓库名 / 绑自定义域名时不用改页面里的链接。
 */
const BASE = import.meta.env.BASE_URL || '/';

export function url(path = '/'): string {
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${clean}`;
}
