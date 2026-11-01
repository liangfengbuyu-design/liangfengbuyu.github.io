/**
 * 设置与数据（S6）
 *
 * 本页是唯一做「文件下载 / 读文件」的地方 —— 这属于浏览器 IO，不是视图渲染，
 * 因此不受 V1（整块重渲染）约束。业务数据仍由外部注入与回调。
 */

import { esc } from "../../ui/dom.js";
import { dayKey } from "../../core/date.js";
import { DAILY_GOALS, THEMES, THEME_LABEL } from "../../core/settings.js";

export function createSettingsPage({
  bank,
  getSettings,
  onBack,
  onChange,
  onExport,
  onImportText,
  onClearAll,
}) {
  function goalSegs() {
    const settings = getSettings();
    return DAILY_GOALS.map(
      (g) => `<button type="button" class="seg${settings.dailyGoal === g ? " seg-on" : ""}"
              data-action="goal" data-value="${g}">${g}</button>`
    ).join("");
  }

  function themeSegs() {
    const settings = getSettings();
    return THEMES.map(
      (t) => `<button type="button" class="seg${settings.theme === t ? " seg-on" : ""}"
              data-action="theme" data-value="${esc(t)}">${esc(THEME_LABEL[t] || t)}</button>`
    ).join("");
  }

  function render() {
    const total = bank.questions.length;
    const pending = bank.questions.filter((q) => q.verify && q.verify.status === "pending").length;

    return `
      <main class="page page-settings">
        <header class="quiz-bar">
          <button type="button" class="icon-btn" data-action="back" aria-label="返回">←</button>
          <span class="quiz-count">设置与数据</span>
          <span class="bar-spacer"></span>
        </header>

        <section class="section">
          <h2 class="section-title">学习</h2>
          <div class="setting-row">
            <span class="setting-label">每日目标</span>
            <div class="seg-group">${goalSegs()}</div>
          </div>
          <p class="muted setting-hint">首页会显示今日已答 / 目标。只作提示，不会阻止你多刷。</p>
        </section>

        <section class="section">
          <h2 class="section-title">外观</h2>
          <div class="setting-row">
            <span class="setting-label">主题</span>
            <div class="seg-group">${themeSegs()}</div>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">数据</h2>
          <button type="button" class="btn btn-ghost btn-block" data-action="export">导出备份文件</button>
          <button type="button" class="btn btn-ghost btn-block" data-action="pick-import">从备份文件导入</button>
          <button type="button" class="btn btn-ghost btn-block" data-action="refresh-cache">
            清除离线缓存并更新
          </button>
          <button type="button" class="btn btn-ghost btn-block btn-danger" data-action="clear">
            清空全部进度
          </button>
          <input type="file" accept=".json,application/json" data-role="import-file" hidden>
          <p class="muted setting-hint">
            导出会生成一个 JSON 文件，含累计统计、错题本、最近 200 条答题记录与设置。
            导入是<b>整体覆盖</b>，不合并。
            <br>
            改过题库或代码后如果看不到变化，点「清除离线缓存并更新」。
          </p>
        </section>

        <section class="section">
          <h2 class="section-title">题库信息</h2>
          <ul class="info-list">
            <li><span>标题</span><span>${esc(bank.meta.title || "—")}</span></li>
            <li><span>内容版本</span><span>${esc(bank.meta.version || "—")}</span></li>
            <li><span>题数</span><span>${total} 题</span></li>
            <li><span>待核对</span><span>${pending} 题</span></li>
            <li><span>更新时间</span><span>${esc(bank.meta.updatedAt || "—")}</span></li>
            <li><span>底本</span><span>${esc(bank.meta.edition || "—")}</span></li>
          </ul>
        </section>

        <p class="muted setting-note">
          本库原文尚未对中华书局点校本逐字核对，标「待核对」者仅供记忆参考。
          数据只存在本机浏览器，不上传任何服务器。
        </p>
      </main>`;
  }

  function downloadBackup() {
    const payload = onExport();
    if (!payload) return;

    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `资治通鉴卷一-备份-${dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handle(action, value) {
    if (action === "back") {
      onBack();
      return undefined;
    }
    if (action === "goal") {
      onChange({ dailyGoal: Number(value) || settings.dailyGoal });
      return undefined;
    }
    if (action === "theme") {
      onChange({ theme: value });
      return undefined;
    }
    if (action === "export") {
      downloadBackup();
      return undefined;
    }
    if (action === "pick-import") {
      const input = document.querySelector('[data-role="import-file"]');
      if (input) input.click();
      return undefined;
    }
    if (action === "clear") {
      if (window.confirm("将清空累计统计、错题本、答题记录与未完成的那一轮，且不可恢复。确定吗？")) {
        onClearAll();
      }
      return undefined;
    }
    if (action === "import-text") {
      onImportText(value);
      return undefined;
    }
    if (action === "refresh-cache") {
      if (window.confirm("将清除离线缓存并重新加载页面，用于获取最新版本。继续吗？")) {
        if (typeof window.__zztjRefreshCache === "function") {
          window.__zztjRefreshCache();
        } else {
          location.reload();
        }
      }
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
