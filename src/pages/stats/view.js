/**
 * 统计页（S5）
 *
 * 数据由外部注入（getStats / getWrongCount），本模块不碰存储。
 * 所有比率现算，不读任何缓存值（L3 原则）。
 */

import { esc, pct, pctText } from "../../ui/dom.js";
import {
  overallAccuracy,
  typeAccuracy,
  tagRanking,
  guessWarning,
} from "../../core/stats.js";

const WEAK_COUNT = 3;

export function createStatsPage({ bank, getStats, getWrongCount, onSettings }) {
  function typeBar(label, stats, type) {
    const item = (stats.byType && stats.byType[type]) || { a: 0, c: 0 };
    const ratio = item.a ? item.c / item.a : null;
    const width = pct(ratio) || 0;
    return `
      <div class="type-row">
        <span class="type-name">${esc(label)}</span>
        <span class="type-bar"><span class="type-bar-fill" style="width: ${width}%"></span></span>
        <span class="type-value">${item.a ? `${item.c}/${item.a}` : "未练"}</span>
      </div>`;
  }

  function guessBanner(stats) {
    const warn = guessWarning(stats);
    if (!warn) return "";
    return `
      <div class="notice notice-warn">
        判断题正确率 ${pctText(warn.judge)} 高出单选 ${pctText(warn.single)} 约 ${Math.round(
      warn.gap * 100
    )} 个百分点。判断题二选一，猜中概率本就较高，这部分分数未必代表真实掌握。
      </div>`;
  }

  function tagRows(stats) {
    const events = (bank.meta.tagGroups && bank.meta.tagGroups.events) || [];
    const ranking = tagRanking(stats);
    const seen = new Set(ranking.map((r) => r.tag));

    const ordered = [...ranking];
    for (const ev of events) {
      if (!seen.has(ev)) {
        ordered.push({ tag: ev, a: 0, c: 0, accuracy: null, enough: false });
      }
    }

    // 找出「样本充足」的前 3 个，标记为薄弱
    const weakTags = new Set(
      ordered.filter((r) => r.enough).slice(0, WEAK_COUNT).map((r) => r.tag)
    );

    return ordered
      .map((r) => {
        if (!r.a) {
          return `
            <li class="tag-row tag-row-empty">
              <span class="tag-row-name">${esc(r.tag)}</span>
              <span class="tag-row-bar"><span class="tag-row-fill" style="width: 0%"></span></span>
              <span class="tag-row-value">未练</span>
            </li>`;
        }
        const width = pct(r.accuracy) || 0;
        const weak = weakTags.has(r.tag) ? " tag-row-weak" : "";
        const thin = r.enough ? "" : " tag-row-thin";
        return `
          <li class="tag-row${weak}${thin}">
            <span class="tag-row-name">${esc(r.tag)}</span>
            <span class="tag-row-bar"><span class="tag-row-fill" style="width: ${width}%"></span></span>
            <span class="tag-row-value">${pctText(r.accuracy)}<span class="tag-row-count">${r.c}/${r.a}</span></span>
          </li>`;
      })
      .join("");
  }

  function render() {
    const stats = getStats();
    const acc = overallAccuracy(stats);
    const wrongCount = getWrongCount();
    const hasData = stats.totalAnswered > 0;

    return `
      <main class="page page-stats">
        <header class="head">
          <h1 class="title">统计</h1>
          <p class="subtitle">累计作答 ${stats.totalAnswered} 题${
      stats.lastStudyDate ? ` · 最近 ${esc(stats.lastStudyDate)}` : ""
    }</p>
        </header>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${stats.totalAnswered}</div>
            <div class="stat-label">累计答题</div>
          </div>
          <div class="stat">
            <div class="stat-value">${pctText(acc)}</div>
            <div class="stat-label">总正确率</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.streakDays || 0}</div>
            <div class="stat-label">连续学习</div>
            <div class="stat-note">天</div>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${wrongCount}</div>
            <div class="stat-label">错题本</div>
          </div>
          <div class="stat">
            <div class="stat-value">${bank.questions.length}</div>
            <div class="stat-label">题库总量</div>
          </div>
          <div class="stat">
            <div class="stat-value">${bank.questions.filter((q) => q.verify && q.verify.status === "pending").length}</div>
            <div class="stat-label">待核对</div>
          </div>
        </div>

        ${guessBanner(stats)}

        <section class="section">
          <h2 class="section-title">分题型正确率</h2>
          <div class="type-table">
            ${typeBar("单选", stats, "single")}
            ${typeBar("判断", stats, "judge")}
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">事件强弱（弱在前）</h2>
          ${
            hasData
              ? `<ul class="tag-rows">${tagRows(stats)}</ul>
                 <p class="muted tag-legend">样本少于 3 题的标签按实际数值排列但不标红，仅供参考。</p>`
              : `<p class="muted">还没有作答记录。刷几题之后这里会出现各事件的正确率。</p>`
          }
        </section>

        <section class="section">
          <h2 class="section-title">数据</h2>
          <button type="button" class="btn btn-ghost btn-block" data-action="settings">
            设置与数据（导出 / 导入 / 清空）
          </button>
          <p class="muted foot-note">数据只存在本机浏览器，不影响题库文件。</p>
        </section>
      </main>`;
  }

  function handle(action) {
    if (action === "settings") {
      onSettings();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
