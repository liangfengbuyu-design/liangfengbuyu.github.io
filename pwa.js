/**
 * pwa.js —— Service Worker 注册（M5）
 *
 * 提供三个逃生口，避免被缓存困住：
 *   ?nosw=1     本次访问注销 Service Worker 并清空全部缓存（开发调试用）
 *   window.__zztjRefreshCache()  供设置页「清除缓存并更新」按钮调用
 *   新版本激活后自动刷新一次（M6-B 起）—— 否则用户要手动刷两次才看到新代码
 */

const REGISTER_PATH = "./sw.js";
const SCOPE = "./";
const RELOAD_FLAG = "zj:sw-reloaded";

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
  /**
   * 新 SW 接管时自动刷新一次。
   *
   * 为什么必须这么做：SW 对 JS/CSS 是 cache-first，旧 SW 仍控制页面时，
   * 刷新拿到的是缓存里的旧文件；新 SW 装好要等「下一次」刷新才生效。
   * 用户往往只刷一次，于是以为「改了没生效」。
   *
   * 两个防循环护栏：
   *   1. 只在「页面本来就有 controller」时刷 —— 首次安装不刷；
   *   2. sessionStorage 标记，本次浏览器会话最多自动刷一次。
   */
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch (e) {
      return;
    }
    reloading = true;
    console.log("[pwa] 新版本已接管，正在自动刷新一次…");
    location.reload();
  });

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
            console.log("[pwa] 新版本已激活");
          }
        });
      });

      console.log("[pwa] Service Worker 已注册，可离线使用");
    } catch (e) {
      console.warn("[pwa] Service Worker 注册失败（页面仍可正常使用，只是不支持离线）", e);
    }
  });
}
