/**
 * 错题本（S4）
 *
 * 数据由外部注入（getWrong），本模块不碰存储 —— 便于测试，也符合 D2。
 * 只发意图：开始刷、移出单题、清空。
 */

import { esc, relativeTime } from "../../ui/dom.js";
import { typeBadge } from "../../ui/components.js";
import { listWrong, streakProgress } from "../../core/wrongbook.js";

export function createWrongPage({ bank, getWrong, onStart, onRemove, onClear, onGoHome, onOpen }) {
  let filterTag = null;

  function rows() {
    const book = getWrong() || {};
    return listWrong(book)
      .map((entry) => {
        const q = bank.index.get(entry.qid);
        return q ? { ...entry, q } : null;
      })
      .filter(Boolean);
  }

  function filterChips(all) {
    const counts = {};
    for (const r of all) {
      const ev = (r.q.source && r.q.source.event) || "未分类";
      counts[ev] = (counts[ev] || 0) + 1;
    }
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (tags.length <= 1) return "";

    const chips = [
      `<button type="button" class="chip-btn${filterTag === null ? " chip-btn-on" : ""}"
               data-action="filter" data-value="">全部<span class="chip-count">${all.length}</span></button>`,
      ...tags.map(
        (t) => `<button type="button" class="chip-btn${filterTag === t ? " chip-btn-on" : ""}"
                 data-action="filter" data-value="${esc(t)}">
            ${esc(t)}<span class="chip-count">${counts[t]}</span>
          </button>`
      ),
    ].join("");

    return `<div class="chips-wrap section">${chips}</div>`;
  }

  function row(list) {
    return list
      .map((r) => {
        const ev = (r.q.source && r.q.source.event) || "未分类";
        const progress = streakProgress(r);
        const dots = "●".repeat(progress.done) + "○".repeat(progress.total - progress.done);
        return `
        <li class="wrong-row" data-action="open" data-value="${esc(r.qid)}" role="button" tabindex="0">
          <div class="wrong-main">
            <div class="wrong-stem">${esc(r.q.stem.slice(0, 30))}${r.q.stem.length > 30 ? "…" : ""}</div>
            <div class="wrong-meta">
              ${typeBadge(r.q.type)}
              <span class="chip">${esc(ev)}</span>
              <span class="wrong-time">${esc(relativeTime(r.lastWrongAt))}</span>
            </div>
          </div>
          <div class="wrong-side">
            <span class="dots" title="连续答对 ${progress.done}/${progress.total} 次后移出">${dots}</span>
            <span class="dots-label">${esc(progress.label)}</span>
            <button type="button" class="link-btn" data-action="remove" data-value="${esc(r.qid)}">移出</button>
          </div>
        </li>`;
      })
      .join("");
  }

  function emptyState() {
    return `
      <div class="empty-state">
        <p class="empty-title">暂无错题</p>
        <p class="muted">刷一轮新题，答错的会自动进来。</p>
        <button type="button" class="btn btn-primary" data-action="go-home">去刷题</button>
      </div>`;
  }

  function render() {
    const all = rows();
    const list = filterTag ? all.filter((r) => (r.q.source && r.q.source.event) === filterTag) : all;

    if (!all.length) {
      return `
        <main class="page page-wrong">
          <header class="head">
            <h1 class="title">错题本</h1>
            <p class="subtitle">答错的题会出现在这里</p>
          </header>
          ${emptyState()}
        </main>`;
    }

    return `
      <main class="page page-wrong">
        <header class="head">
          <h1 class="title">错题本</h1>
          <p class="subtitle">共 ${all.length} 题 · 连续答对 2 次自动移出</p>
        </header>

        ${filterChips(all)}

        <ul class="wrong-rows">${row(list)}</ul>

        <div class="wrong-actions">
          <button type="button" class="btn btn-primary btn-block" data-action="drill">
            刷这些错题（${list.length}）
          </button>
          <button type="button" class="btn btn-ghost btn-block" data-action="clear">清空错题本</button>
        </div>
      </main>`;
  }

  function handle(action, value) {
    if (action === "filter") {
      filterTag = value || null;
      return "rerender";
    }
    if (action === "remove") {
      onRemove(value);
      return "rerender";
    }
    if (action === "drill") {
      const all = rows();
      const list = filterTag ? all.filter((r) => (r.q.source && r.q.source.event) === filterTag) : all;
      onStart(list.map((r) => r.qid));
      return undefined;
    }
    if (action === "clear") {
      if (window.confirm("清空后所有错题记录都会消失，且不可恢复。确定吗？")) {
        onClear();
        filterTag = null;
        return "rerender";
      }
      return undefined;
    }
    if (action === "open") {
      if (value) onOpen(value);
      return undefined;
    }
    if (action === "go-home") {
      onGoHome();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
