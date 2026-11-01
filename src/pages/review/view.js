/**
 * 单题回顾（P7）—— 只读
 *
 * 从错题本或结算页进入，看这道题的完整解析与当时的作答。
 * 不做判分、不写数据、不计入统计。
 */

import { esc, relativeTime } from "../../ui/dom.js";
import { optionStates } from "../../core/review.js";
import { lastAnswerFor } from "../../core/history.js";
import { typeBadge, optionList, verdictBar, analysisPanel } from "../../ui/components.js";

const MODE_LABEL = {
  sequence: "顺序刷",
  random: "随机刷",
  byTag: "按事件刷",
  wrongOnly: "只刷错题",
};

export function createReviewPage({ bank, qid, history, onBack }) {
  const question = qid ? bank.index.get(qid) : null;
  const record = qid ? lastAnswerFor(history, qid) : null;

  function render() {
    if (!question) {
      return `
        <main class="page page-review">
          <header class="quiz-bar">
            <button type="button" class="icon-btn" data-action="back" aria-label="返回">←</button>
            <span class="quiz-count">题目回顾</span>
            <span class="bar-spacer"></span>
          </header>
          <p class="muted">这道题已不在题库中（可能题库更新时被移除）。</p>
        </main>`;
    }

    const selected = record ? record.selected : null;
    const skipped = record ? record.skipped : false;
    const states = optionStates(question, selected, true);

    const recordLine = record
      ? `<p class="review-meta">上次作答：${esc(relativeTime(record.ts))}${
          record.mode ? ` · ${esc(MODE_LABEL[record.mode] || record.mode)}` : ""
        }</p>`
      : `<p class="review-meta">还没有作答记录，下面是正确答案与解析。</p>`;

    return `
      <main class="page page-review">
        <header class="quiz-bar">
          <button type="button" class="icon-btn" data-action="back" aria-label="返回">←</button>
          <span class="quiz-count">${esc(qid)}</span>
          ${typeBadge(question.type)}
        </header>

        <h1 class="stem">${esc(question.stem)}</h1>

        ${optionList(states, true)}

        ${
          record
            ? verdictBar({ correct: !!record.correct, skipped, correctId: question.answer })
            : ""
        }
        ${recordLine}

        ${analysisPanel(question)}

        <div class="review-actions">
          <button type="button" class="btn btn-ghost btn-block" data-action="back">返回</button>
        </div>
      </main>`;
  }

  function handle(action) {
    if (action === "back") {
      onBack();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
