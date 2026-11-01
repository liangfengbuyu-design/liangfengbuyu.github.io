/**
 * router.js —— hash 路由（M2）
 *
 * 全项目唯一涉及 location 的地方。
 * 用 hash 而非普通路径：静态托管刷新不会 404，不需要配置 rewrite 规则。
 */

/**
 * @param {object} opts
 * @param {string} opts.fallback 默认页名
 * @param {(name: string) => void} opts.onChange 页面名变化时的回调
 */
export function createRouter({ fallback = "home", onChange }) {
  function read() {
    const raw = String(location.hash || "").replace(/^#\/?/, "").trim();
    if (!raw) return { name: fallback, params: [] };
    const parts = raw.split("/").filter(Boolean);
    return { name: parts[0] || fallback, params: parts.slice(1) };
  }

  function pathOf(name, params) {
    return [name, ...(params || [])].filter(Boolean).join("/");
  }

  function emit() {
    const route = read();
    onChange(route.name, route.params);
  }

  window.addEventListener("hashchange", emit);

  return {
    start() {
      if (!location.hash) {
        history.replaceState(null, "", `#/${fallback}`);
      }
      emit();
    },
    go(name, ...params) {
      const target = pathOf(name, params);
      const cur = read();
      if (pathOf(cur.name, cur.params) === target) {
        emit();
        return;
      }
      location.hash = `#/${target}`;
    },
    current() {
      return read();
    },
  };
}
