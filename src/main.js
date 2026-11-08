/**
 * main.js —— 应用装配（M4）
 *
 * 六个存储 key：meta / stats / wrong / session / history / settings
 *
 * 边界不变：
 *   - 页面只发意图，所有写存储的动作集中在本文件的 commit* 与 persist* 系列
 *   - 存储只经 store/storage.js，页面不碰 localStorage（D2）
 */

import { loadIndex, emptyBank, loadVolumes, volumeOfQid } from "./core/loader.js";
import { createSession, restoreSession, answeredCount, MODE } from "./core/session.js";
import { emptyStats, overallAccuracy, applyAnswer as applyStatsAnswer } from "./core/stats.js";
import {
  emptyBook,
  countWrong,
  applyAnswer as applyWrongAnswer,
  removeFromBook,
} from "./core/wrongbook.js";
import { emptyHistory, appendEntry, countOnDay } from "./core/history.js";
import { normalizeSettings } from "./core/settings.js";
import { buildBackup, validateBackup, describeBackup } from "./core/backup.js";
import { dayKey } from "./core/date.js";
import * as storage from "./store/storage.js";
import { createRouter } from "./router.js";
import { createHomePage } from "./pages/home/view.js";
import { createQuizPage } from "./pages/quiz/view.js";
import { createSummaryPage } from "./pages/summary/view.js";
import { createWrongPage } from "./pages/wrong/view.js";
import { createStatsPage } from "./pages/stats/view.js";
import { createSettingsPage } from "./pages/settings/view.js";
import { createReviewPage } from "./pages/review/view.js";
import { createScopePage } from "./pages/scope/view.js";
import { esc } from "./ui/dom.js";

const app = document.getElementById("app");
const tabsEl = document.getElementById("tabs");

const TABS = [
  { name: "home", label: "刷题" },
  { name: "wrong", label: "错题" },
  { name: "stats", label: "统计" },
];

const appState = {
  bank: null,
  session: null,
  stats: emptyStats(),
  wrong: emptyBook(),
  history: emptyHistory(),
  settings: normalizeSettings(null),
  readOnly: false,
  storageNote: null,
};

let page = null;
let lastTab = "home";

/* ------------------------------------------------------------ 主题与外框 */

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

function renderTabs(current) {
  if (!tabsEl) return;

  const isTabPage = TABS.some((t) => t.name === current);
  tabsEl.className = isTabPage ? "tabs tabs-on" : "tabs";

  if (!isTabPage) {
    tabsEl.innerHTML = "";
    return;
  }

  const wrongCount = countWrong(appState.wrong);
  tabsEl.innerHTML = TABS.map((t) => {
    const on = t.name === current ? " tab-on" : "";
    const badge =
      t.name === "wrong" && wrongCount > 0 ? `<span class="tab-badge">${wrongCount}</span>` : "";
    return `<button type="button" class="tab${on}" data-action="tab" data-value="${esc(t.name)}">
        ${esc(t.label)}${badge}
      </button>`;
  }).join("");
}

function paint({ keepScroll = false } = {}) {
  const y = window.scrollY;
  app.innerHTML = page ? page.render() : "";
  window.scrollTo(0, keepScroll ? y : 0);
  renderTabs(router.current().name);
}

/**
 * 按需下载卷并并入 bank（M6-D）。
 *
 * 失败只警告不抛出：某卷文件坏了，不该让整个应用打不开；
 * 上层会在题目为空时给出提示。
 */
async function ensureVolumes(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const { bank, failures } = await loadVolumes(appState.bank, ids);
  appState.bank = bank;
  window.__bank = bank;
  if (failures.length) {
    console.warn(
      "[loader] 部分卷加载失败：",
      failures.map((f) => `${f.id}（${f.error.message}）`)
    );
  }
  return failures;
}

/** 所有卷的 id（用于「不限范围」时按需加载）。 */
function allVolumeIds() {
  return appState.bank.volumes.map((v) => v.id);
}

/** 一组题号涉及的卷 id，去重。 */
function volumesOfQids(qids) {
  const out = [];
  for (const id of qids) {
    const v = volumeOfQid(id);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * 当前环境是否支持离线缓存。
 * Service Worker 只在安全上下文可用：https、localhost、127.0.0.1 都算；
 * 手机通过局域网 http://192.168.x.x 访问则不算。
 */
function isOfflineCapable() {
  try {
    return window.isSecureContext === true && "serviceWorker" in navigator;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------ 持久化写入 */

function reloadFromStorage() {
  appState.stats = storage.readStats() || emptyStats();
  appState.wrong = storage.readWrong() || emptyBook();
  appState.history = storage.readHistory() || emptyHistory();
  appState.settings = normalizeSettings(storage.readSettings());
  applyTheme(appState.settings.theme);
}

function persistSession() {
  if (appState.readOnly) return;
  if (appState.session) storage.writeSession(appState.session);
  else storage.clearSession();
}

function commitAnswer({ qid, selected = null, correct = false, skipped = false }) {
  if (appState.readOnly) return;
  const q = appState.bank.index.get(qid);
  if (!q) return;

  const mode = appState.session ? appState.session.mode : MODE.SEQUENCE;

  if (!skipped) {
    appState.stats = applyStatsAnswer(appState.stats, q, correct);
    appState.wrong = applyWrongAnswer(appState.wrong, qid, correct);
    storage.writeStats(appState.stats);
    storage.writeWrong(appState.wrong);
  }

  appState.history = appendEntry(appState.history, {
    qid,
    selected,
    correct,
    skipped,
    ts: Date.now(),
    mode,
  });
  storage.writeHistory(appState.history);
}

function commitRemoveWrong(qid) {
  if (appState.readOnly) return;
  appState.wrong = removeFromBook(appState.wrong, qid);
  storage.writeWrong(appState.wrong);
}

function commitClearAll() {
  if (appState.readOnly) return;
  appState.stats = emptyStats();
  appState.wrong = emptyBook();
  appState.history = emptyHistory();
  appState.session = null;
  storage.writeStats(appState.stats);
  storage.writeWrong(appState.wrong);
  storage.writeHistory(appState.history);
  storage.clearSession();
}

function commitSettings(patch) {
  appState.settings = normalizeSettings({ ...appState.settings, ...patch });
  storage.writeSettings(appState.settings);
  applyTheme(appState.settings.theme);
}

/* ------------------------------------------------------------------ 会话 */

/**
 * 当前可继续的会话：顺便把光标推到第一个未答题。
 * 退出时若停在已判定的题上，cursor 会指向已答题，这里统一修正。
 */
function resumableSession() {
  const s = appState.session;
  if (!s) return null;

  let cursor = s.cursor;
  while (cursor < s.queue.length && s.answers[s.queue[cursor]]) cursor += 1;
  if (cursor >= s.queue.length) return null;

  return cursor === s.cursor ? s : { ...s, cursor };
}

function resumeInfo() {
  const s = appState.session;
  if (!s) return null;
  const answered = answeredCount(s);
  if (answered >= s.queue.length) return null;
  return { answered, total: s.queue.length, mode: s.mode };
}

async function startSession(mode, tag, limit, onlyIds = null, volumeIds = null) {
  /* 先算出这一轮要用哪些卷，按需下载（M6-D）。
     不限范围 = 全部卷；只刷错题 = 错题所在的那几卷。 */
  const ids =
    mode === MODE.WRONG_ONLY
      ? volumesOfQids(Object.keys(appState.wrong))
      : volumeIds && volumeIds.length
        ? volumeIds
        : allVolumeIds();

  const failures = await ensureVolumes(ids);
  if (failures.length && !appState.bank.loaded.length) {
    window.alert("题库加载失败，请检查网络后重试。");
    return;
  }

  const session = createSession({
    questions: appState.bank.questions,
    mode,
    tag,
    limit,
    volumeIds,
    onlyIds: onlyIds || (mode === MODE.WRONG_ONLY ? Object.keys(appState.wrong) : null),
  });

  if (!session.queue.length) {
    window.alert("该条件下没有题目，请换一个模式或范围再试。");
    return;
  }

  appState.session = session;
  persistSession();
  router.go("quiz");
}

/* ------------------------------------------------------------------ 路由 */

const router = createRouter({
  fallback: "home",
  async onChange(name, params) {
    if (TABS.some((t) => t.name === name)) lastTab = name;

    if (name === "quiz") {
      const session = resumableSession();
      if (!session) {
        router.go("home");
        return;
      }
      appState.session = session;
      /* 题目可能还没下载（M6-D），先补齐再画，避免出现空题干 */
      await ensureVolumes(volumesOfQids(session.queue));
      page = createQuizPage({
        bank: appState.bank,
        session,
        onSessionChange(next) {
          appState.session = next;
          persistSession();
        },
        onAnswer: commitAnswer,
        onFinish(next) {
          /* 保留内存中的 session 供结算页使用；存储里的快照要清掉，
             因为它已经没有「可继续」的意义了。 */
          appState.session = next;
          storage.clearSession();
          router.go("summary");
        },
        onQuit() {
          persistSession();
          router.go("home");
        },
      });
    } else if (name === "summary") {
      if (!appState.session) {
        router.go("home");
        return;
      }
      page = createSummaryPage({
        bank: appState.bank,
        session: appState.session,
        onRestart() {
          const s = appState.session;
          startSession(s.mode, s.filter.tag, s.filter.limit, null, s.filter.volumeIds);
        },
        onHome() {
          appState.session = null;
          router.go("home");
        },
      });
    } else if (name === "wrong") {
      /* 错题本要显示题干，先按需下载错题所在的卷（M6-D）。
         首帧用现有数据画，下载完再重画一次，避免白屏等网络。 */
      const wrongIds = volumesOfQids(Object.keys(appState.wrong));
      page = createWrongPage({
        bank: appState.bank,
        getWrong: () => appState.wrong,
        onStart(ids) {
          startSession(MODE.WRONG_ONLY, null, 0, ids);
        },
        onRemove: commitRemoveWrong,
        onClear() {
          appState.wrong = emptyBook();
          storage.writeWrong(appState.wrong);
        },
        onGoHome() {
          router.go("home");
        },
        onOpen(qid) {
          router.go("review", qid);
        },
      });
      if (wrongIds.length) {
        ensureVolumes(wrongIds).then(() => {
          if (router.current().name === "wrong") paint({ keepScroll: true });
        });
      }
    } else if (name === "stats") {
      page = createStatsPage({
        bank: appState.bank,
        getStats: () => appState.stats,
        getWrongCount: () => countWrong(appState.wrong),
        onSettings() {
          router.go("settings");
        },
      });
    } else if (name === "settings") {
      page = createSettingsPage({
        bank: appState.bank,
        getSettings: () => appState.settings,
        onBack() {
          router.go(lastTab);
        },
        onChange(patch) {
          commitSettings(patch);
          router.go("settings");
        },
        onExport() {
          return buildBackup(appState);
        },
        onImportText(text) {
          importBackup(text);
        },
        onClearAll() {
          commitClearAll();
          router.go("home");
        },
      });
    } else if (name === "review") {
      const qid = params && params[0] ? params[0] : null;
      /* 单题回顾只需要它所在的那一卷 */
      const vid = volumeOfQid(qid);
      if (vid) await ensureVolumes([vid]);
      page = createReviewPage({
        bank: appState.bank,
        qid,
        history: appState.history,
        onBack() {
          router.go(lastTab);
        },
      });
    } else if (name === "scope") {
      page = createScopePage({
        bank: appState.bank,
        initialVolumes: appState.settings.lastScopeVolumes,
        initialLimit: appState.settings.lastScopeLimit,
        onStart({ volumeIds, limit }) {
          commitSettings({ lastScopeVolumes: volumeIds, lastScopeLimit: limit });
          startSession(MODE.CUSTOM, null, limit, null, volumeIds);
        },
        onBack() {
          router.go("home");
        },
      });
    } else {
      page = createHomePage({
        bank: appState.bank,
        summary: {
          totalAnswered: appState.stats.totalAnswered,
          accuracy: overallAccuracy(appState.stats),
          wrongCount: countWrong(appState.wrong),
          storageNote: appState.storageNote,
          offlineCapable: isOfflineCapable(),
          resume: resumeInfo(),
          today: {
            count: countOnDay(appState.history, dayKey()),
            goal: appState.settings.dailyGoal,
          },
        },
        onStart({ mode, tag, limit, volumeIds }) {
          startSession(mode, tag, limit, null, volumeIds);
        },
        onResume() {
          router.go("quiz");
        },
        onDiscard() {
          appState.session = null;
          storage.clearSession();
          router.go("home");
        },
        onSettings() {
          router.go("settings");
        },
        onScope() {
          router.go("scope");
        },
      });
    }

    paint();
  },
});

/* ---------------------------------------------------------------- 导入 */

function importBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    window.alert("文件不是合法的 JSON，导入已取消。");
    return;
  }

  const error = validateBackup(obj);
  if (error) {
    window.alert(error);
    return;
  }

  const ok = window.confirm(
    `导入会整体覆盖当前数据（不合并）。\n\n${describeBackup(obj)}\n\n确定导入吗？`
  );
  if (!ok) return;

  if (!storage.writeAll(obj)) {
    window.alert("写入失败：浏览器存储空间不足或被禁用。");
    return;
  }

  reloadFromStorage();
  appState.session = null;
  storage.clearSession();

  router.go("home");
}

/* -------------------------------------------------------- 全局事件委托 */

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest("[data-action]");
  if (!trigger) return;
  if (trigger.hasAttribute("disabled")) return;

  const action = trigger.dataset.action;
  const value = trigger.dataset.value;

  if (action === "tab") {
    router.go(value);
    return;
  }

  if (!page || typeof page.handle !== "function") return;

  const result = page.handle(action, value);
  if (result === "rerender") {
    paint({ keepScroll: true });
  }
});

/* 导入文件：input 的 change 不是 click，单独处理 */
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.dataset.role !== "import-file") return;

  const file = el.files && el.files[0];
  el.value = "";
  if (!file || !page || typeof page.handle !== "function") return;

  let text = "";
  try {
    text = await file.text();
  } catch (e) {
    window.alert("读取文件失败，请重试。");
    return;
  }

  page.handle("import-text", text);
});

/* ------------------------------------------------------------------ 启动 */

function renderError(message) {
  return `
    <main class="page">
      <h1 class="title">加载失败</h1>
      <div class="alert alert-error">${esc(message)}</div>
      <div class="hint">
        <p>常见原因：</p>
        <p>1. 直接双击了 index.html —— 必须通过 <code>run.bat</code> 启动本地服务。</p>
        <p>2. <code>data/meta.json</code> 或某一卷题库存在语法错误 —— 运行 <code>python tools/check.py --all</code> 查看具体行号。</p>
      </div>
    </main>`;
}

async function boot() {
  app.innerHTML = `<main class="page"><p class="muted">正在加载题库…</p></main>`;

  try {
    /* M6-D：启动只读索引（几 KB），不下载任何卷。
       首页、范围页、统计页都只靠索引即可渲染。 */
    const indexData = await loadIndex();
    appState.bank = emptyBank(indexData);
    window.__bank = appState.bank;

    const metaState = storage.ensureMeta();
    appState.readOnly = metaState.readOnly;

    reloadFromStorage();

    /* 恢复未完成的那一轮：先下载它涉及的卷，才能校验题号是否还有效 */
    const snapshot = storage.readSession();
    if (snapshot) {
      const ids = volumesOfQids(Array.isArray(snapshot.queue) ? snapshot.queue : []);
      await ensureVolumes(ids);
      appState.session = restoreSession(snapshot, appState.bank.index);
      if (!appState.session) storage.clearSession();
    }

    if (!storage.isAvailable()) {
      appState.storageNote = "浏览器存储不可用（可能是隐私模式或已禁用），本次作答不会保存。";
    } else if (appState.readOnly) {
      appState.storageNote = "检测到更高版本的数据，当前为只读模式，作答不会被保存。";
    }

    const resumed = resumeInfo();
    const totals = appState.bank.meta.totals;
    console.log(
      `[M6] 索引 ${totals.volumes} 卷 ${totals.questions} 题（待核对 ${totals.pending}）；` +
        `已载入 ${appState.bank.loaded.length} 卷；累计 ${appState.stats.totalAnswered} 题；` +
        `错题 ${countWrong(appState.wrong)} 条；日志 ${appState.history.length} 条；` +
        `未完成会话 ${resumed ? `${resumed.answered}/${resumed.total}` : "无"}`
    );

    router.start();
  } catch (e) {
    app.innerHTML = renderError(e.message);
    console.error("[M4] 启动失败：", e);
  }
}

boot();
