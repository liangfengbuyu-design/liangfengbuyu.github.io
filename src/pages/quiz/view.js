/**
 * 答题页（S2）—— 本模块是全应用最重的一页
 *
 * 状态机：idle →（选中选项）→ revealed →（下一题）→ idle
 * 状态全部在本模块闭包里（V2），DOM 只负责显示。
 *
 * 判定采用「选中即判」，不设提交按钮：两种题型都是客观题，多一次点击只增加摩擦。
 */

import { esc } from "../../ui/dom.js";
import { judge, optionStates } from "../../core/review.js";
import { currentId, recordAnswer, advance, isLastQuestion } from "../../core/session.js";
import { typeBadge, optionList, verdictBar, analysisPanel } from "../../ui/components.js";

export function createQuizPage({ bank, session, onFinish, onQuit, onSessionChange, onAnswer }) {
  let local = session;
  let revealed = false;
  let picked = null;
  let skipped = false;

  function currentQuestion() {
    const id = currentId(local);
    return id ? bank.index.get(id) || null : null;
  }

  function render() {
    const q = currentQuestion();
    if (!q) {
      return `<main class="page"><p class="muted">本轮已结束。</p></main>`;
    }

    const total = local.queue.length;
    const idx = local.cursor + 1;
    const width = Math.round((idx / total) * 100);
    const states = optionStates(q, picked, revealed);
    const isCorrect = revealed && !skipped && picked === q.answer;
    const last = isLastQuestion(local);

    const footer = revealed
      ? `<button type="button" class="btn btn-primary btn-block" data-action="next">
           ${last ? "查看本轮结果" : "下一题"}
         </button>`
      : `<button type="button" class="btn btn-ghost btn-block" data-action="skip">不会，跳过</button>`;

    return `
      <main class="page page-quiz">
        <header class="quiz-bar">
          <button type="button" class="icon-btn" data-action="quit" aria-label="退出">×</button>
          <span class="quiz-count">${idx} / ${total}</span>
          ${typeBadge(q.type)}
        </header>

        <div class="bar"><div class="bar-fill" style="width: ${width}%"></div></div>

        <h1 class="stem">${esc(q.stem)}</h1>

        ${optionList(states, revealed)}

        ${revealed ? verdictBar({ correct: isCorrect, skipped, correctId: q.answer }) : ""}
        ${revealed ? analysisPanel(q) : ""}

        <div class="quiz-actions">${footer}</div>
      </main>`;
  }

  function handle(action, value) {
    if (action === "pick") {
      if (revealed) return undefined;
      const q = currentQuestion();
      if (!q) return undefined;

      const result = judge(q, value);
      picked = value;
      skipped = false;
      revealed = true;
      local = recordAnswer(local, q.id, { selected: value, correct: result.correct });
      if (onSessionChange) onSessionChange(local);
      /* 只有真正作答才计入统计与错题本；跳过不算。 */
      if (onAnswer) onAnswer({ qid: q.id, selected: value, correct: result.correct });
      return "rerender";
    }

    if (action === "skip") {
      if (revealed) return undefined;
      const q = currentQuestion();
      if (!q) return undefined;

      picked = null;
      skipped = true;
      revealed = true;
      local = recordAnswer(local, q.id, { skipped: true });
      if (onSessionChange) onSessionChange(local);
      /* 跳过只进历史日志，不进统计与错题本。 */
      if (onAnswer) onAnswer({ qid: q.id, selected: null, correct: false, skipped: true });
      return "rerender";
    }

    if (action === "next") {
      local = advance(local);
      if (onSessionChange) onSessionChange(local);
      revealed = false;
      picked = null;
      skipped = false;

      if (local.cursor >= local.queue.length) {
        onFinish(local);
        return undefined;
      }
      return "rerender";
    }

    if (action === "quit") {
      const done = Object.keys(local.answers).length;
      const ok = window.confirm(
        done
          ? `已作答 ${done} 题，进度会自动保存，可从首页「继续上次」接着答。现在退出？`
          : "退出本轮？"
      );
      if (ok) onQuit();
      return undefined;
    }

    return undefined;
  }

  return { render, handle };
}
