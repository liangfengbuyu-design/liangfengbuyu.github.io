/**
 * sw.js —— Service Worker（M5）
 *
 * ⚠️ 每次修改以下任一文件后，都必须把下面的 VERSION 加一（如 1.0.0 → 1.0.1），
 *    否则浏览器会继续用旧缓存，你会以为改动没生效。
 *    index.html / src 下任何 js / 任何 css / manifest / 图标
 *
 * 三类资源三种策略（对应你选定的「缓存优先 + 静默更新」）：
 *   1. 导航请求（打开页面）  network-first，2.5 秒超时回退缓存
 *      —— 保证一联网就能拿到最新 HTML，离线时立刻用缓存
 *   2. 静态资源（js/css/图标）cache-first，缓存名带版本号
 *      —— 最快的加载；版本号一变，旧缓存整体作废重建
 *   3. 题库 JSON            stale-while-revalidate
 *      —— 先返回缓存（秒开），同时后台拉新，下次打开就是最新的
 *         这样既满足「缓存优先」的速度，又避免改了题库却看不到
 */

const VERSION = "20261101-160016";

const SHELL_CACHE = `zztj-shell-${VERSION}`;
const DATA_CACHE = "zztj-data-v1";

/* 预缓存清单：缺一个都会导致 install 失败，增删文件时记得同步这里 */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./pwa.js",
  "./assets/app.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./src/main.js",
  "./src/router.js",
  "./src/core/date.js",
  "./src/core/loader.js",
  "./src/core/guard.js",
  "./src/core/derive.js",
  "./src/core/session.js",
  "./src/core/review.js",
  "./src/core/wrongbook.js",
  "./src/core/stats.js",
  "./src/core/history.js",
  "./src/core/settings.js",
  "./src/core/backup.js",
  "./src/store/storage.js",
  "./src/ui/dom.js",
  "./src/ui/components.js",
  "./src/pages/home/view.js",
  "./src/pages/home/style.css",
  "./src/pages/quiz/view.js",
  "./src/pages/quiz/style.css",
  "./src/pages/summary/view.js",
  "./src/pages/summary/style.css",
  "./src/pages/wrong/view.js",
  "./src/pages/wrong/style.css",
  "./src/pages/stats/view.js",
  "./src/pages/stats/style.css",
  "./src/pages/settings/view.js",
  "./src/pages/settings/style.css",
  "./src/pages/review/view.js",
  "./src/pages/review/style.css",
];

/* ------------------------------------------------------------ install */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);

      /* 题库也预存一份种子。
         原因：首次访问时 SW 尚未接管页面，页面发起的题库请求不经过 fetch 事件，
         若不在这里种子，首访后立刻断网就没有题库可用。
         之后题库靠 stale-while-revalidate 自动更新，不需要重装 SW。 */
      try {
        const dataCache = await caches.open(DATA_CACHE);
        await dataCache.add("./data/questions.v01.json");
      } catch (e) {
        /* 题库暂时取不到不影响离线外壳，忽略 */
      }

      /* 静默更新：不等用户点确认，新版本立即进入等待→激活 */
      await self.skipWaiting();
    })()
  );
});

/* ------------------------------------------------------------ activate */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("zztj-shell-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      );
      /* 立即接管所有已打开的页面 */
      await self.clients.claim();
    })()
  );
});

/* --------------------------------------------------------------- 策略 */

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response("", { status: 504, statusText: "offline" });
  }
}

async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), 2500);
  });

  try {
    const response = await Promise.race([fetch(request), timeout]);
    if (response && response.ok) {
      cache.put("./index.html", response.clone());
      return response;
    }
    throw new Error("bad response");
  } catch (e) {
    const cached = await cache.match("./index.html");
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset='utf-8'><title>离线</title><p style='font-family:sans-serif;padding:2em'>离线且没有缓存，请联网后重新打开一次。</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;

  return new Response(
    JSON.stringify({ meta: {}, questions: [] }),
    { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}

/* --------------------------------------------------------------- fetch */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* 只处理同源请求；跨域一律放行 */
  if (url.origin !== self.location.origin) return;

  /* 题库：缓存优先 + 后台更新 */
  if (url.pathname.includes("/data/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* 打开页面 */
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  /* 其余静态资源 */
  event.respondWith(cacheFirst(request));
});
