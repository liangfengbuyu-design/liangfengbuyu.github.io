/**
 * pwa.js —— Service Worker 注册（M5）
 *
 * 提供两个逃生口，避免被缓存困住：
 *   ?nosw=1     本次访问注销 Service Worker 并清空全部缓存（开发调试用）
 *   window.__zztjRefreshCache()  供设置页「清除缓存并更新」按钮调用
 */

const REGISTER_PATH = "./sw.js";
const SCOPE = "./";

function hasNoSw() {
  try {
    return new URLSearchParams(location.search).has("nosw");
  } catch (e) {
    return false;
  }
}

/** 注销所有 SW 并删除全部缓存，然后重新加载。 */
export async function refreshCacheAndReload({ stripNoSw = false } = {}) {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  if (stripNoSw) {
    /* 把 ?nosw=1 从地址里去掉再重载，否则会陷入「清理→重载→又清理」的循环 */
    const url = new URL(location.href);
    url.searchParams.delete("nosw");
    location.replace(url.toString());
    return;
  }
  location.reload();
}

if (typeof window !== "undefined") {
  window.__zztjRefreshCache = refreshCacheAndReload;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (hasNoSw()) {
      await refreshCacheAndReload({ stripNoSw: true });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(REGISTER_PATH, { scope: SCOPE });

      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "activated") {
            console.log("[pwa] 新版本已激活，下次刷新即为最新代码");
          }
        });
      });

      console.log("[pwa] Service Worker 已注册，可离线使用");
    } catch (e) {
      console.warn("[pwa] Service Worker 注册失败（页面仍可正常使用，只是不支持离线）", e);
    }
  });
}
