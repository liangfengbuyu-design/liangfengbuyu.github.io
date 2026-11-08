/**
 * 结算页（S3）—— M2 最小版
 *
 * 本轮结果的呈现。完整版（错题本入口、标签热力、导出）在 M3 / M4 补齐。
 */

import { esc, pctText, pct } from "../../ui/dom.js";
import { summarizeSession, weakestTags } from "../../core/session.js";

const MODE_LABEL = {
  sequence: "顺序刷",
  random: "随机刷",
  byTag: "按事件刷",
  wrongOnly: "只刷错题",
  custom: "自定义范围",
};

export function createSummaryPage({ bank, session, onRestart, onHome }) {
  const stats = summarizeSession(session, bank.index);
  const weak = weakestTags(stats.byTag, 3, 1);

  function typeRow(label, item) {
    const ratio = item.a ? item.c / item.a : null;
    const w = pct(ratio) || 0;
    return `
      <div class="type-row">
        <span class="type-name">${esc(label)}</span>
        <span class="type-bar"><span class="type-bar-fill" style="width: ${w}%"></span></span>
        <span class="type-value">${item.c}/${item.a}</span>
      </div>`;
  }

  function wrongList() {
    if (!stats.wrongIds.length) {
      return `<p class="muted">本轮没有答错的题。</p>`;
    }
    const rows = stats.wrongIds
      .map((qid) => {
        const q = bank.index.get(qid);
        if (!q) return "";
        const ev = (q.source && q.source.event) || "—";
        return `<li class="wrong-item">
            <span class="wrong-id">${esc(qid)}</span>
            <span class="wrong-stem">${esc(q.stem.slice(0, 26))}…</span>
            <span class="chip">${esc(ev)}</span>
          </li>`;
      })
      .join("");
    return `<ul class="wrong-list">${rows}</ul>`;
  }

  function weakBlock() {
    if (!weak.length) return "";
    const rows = weak
      .map(
        (t) => `<li class="weak-item">
          <span>${esc(t.tag)}</span>
          <span class="weak-rate">${pctText(t.accuracy)}</span>
          <span class="muted">（${t.c}/${t.a}）</span>
        </li>`
      )
      .join("");
    return `
      <section class="section">
        <h2 class="section-title">本轮薄弱事件</h2>
        <ul class="weak-list">${rows}</ul>
      </section>`;
  }

  function render() {
    const modeName = MODE_LABEL[session.mode] || session.mode;

    return `
      <main class="page page-summary">
        <header class="head">
          <h1 class="title">本轮结束</h1>
          <p class="subtitle">${esc(modeName)} · 共 ${stats.total} 题</p>
        </header>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${stats.correct}</div>
            <div class="stat-label">答对</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.wrong}</div>
            <div class="stat-label">答错</div>
          </div>
          <div class="stat">
            <div class="stat-value">${pctText(stats.accuracy)}</div>
            <div class="stat-label">正确率</div>
          </div>
        </div>

        ${stats.skipped ? `<p class="muted">另有 ${stats.skipped} 题跳过，不计入正确率。</p>` : ""}

        <section class="section">
          <h2 class="section-title">分题型</h2>
          <div class="type-table">
            ${typeRow("单选", stats.byType.single)}
            ${typeRow("判断", stats.byType.judge)}
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">本轮错题（${stats.wrongIds.length}）</h2>
          ${wrongList()}
        </section>

        ${weakBlock()}

        <div class="summary-actions">
          <button type="button" class="btn btn-primary btn-block" data-action="restart">再来一轮</button>
          <button type="button" class="btn btn-ghost btn-block" data-action="home">返回首页</button>
        </div>

        <p class="muted foot-note">M3 起，本轮错题会自动进入错题本，可单独重刷。</p>
      </main>`;
  }

  function handle(action) {
    if (action === "restart") {
      onRestart();
      return undefined;
    }
    if (action === "home") {
      onHome();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
