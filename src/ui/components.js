/**
 * components.js —— 跨页复用的 HTML 片段（M2）
 *
 * 全部是「纯函数 → 字符串」，遵守 V1：不在这里做任何 DOM 操作。
 * 片段结构刻意贴近 WXML 的写法（条件块、列表块），便于将来转译。
 */

import { esc, stars } from "./dom.js";

export function typeBadge(type) {
  const label = type === "judge" ? "判断" : "单选";
  return `<span class="badge">${label}</span>`;
}

export function diffStars(n) {
  return `<span class="stars" title="难度 ${esc(n)}/3">${stars(n)}</span>`;
}

/**
 * 「待核对」提示条。pending 时置顶且不可折叠 —— 放在底部你很可能没看到就已把错句记牢。
 */
export function verifyBanner(question) {
  const verify = question && question.verify;
  if (!verify || verify.status !== "pending") return "";
  return `
    <div class="verify-banner" role="note">
      <div class="verify-title">⚠ 本题原文尚未核对</div>
      <div class="verify-note">${esc(verify.note || "待补底本后转为已核对")}</div>
    </div>`;
}

/**
 * 选项列表。
 * @param {Array} states review.optionStates() 的结果
 * @param {boolean} revealed 已判定时禁用点击
 */
export function optionList(states, revealed) {
  const items = states
    .map((s) => {
      const disabled = revealed ? " disabled" : "";
      return `
      <button type="button" class="option option-${s.state}"${disabled}
              data-action="pick" data-value="${esc(s.id)}">
        <span class="option-key">${esc(s.id)}</span>
        <span class="option-text">${esc(s.text)}</span>
      </button>`;
    })
    .join("");
  return `<div class="options">${items}</div>`;
}

/** 判定反馈条。三种结局：答对 / 答错 / 跳过。 */
export function verdictBar({ correct, skipped, correctId }) {
  if (skipped) {
    return `<div class="verdict verdict-skip">已跳过 · 正确答案是 <strong>${esc(correctId)}</strong></div>`;
  }
  if (correct) {
    return `<div class="verdict verdict-ok">✓ 答对</div>`;
  }
  return `<div class="verdict verdict-bad">✕ 答错 · 正确答案是 <strong>${esc(correctId)}</strong></div>`;
}

/**
 * 解析面板。
 * 结构固定为：待核对提示 → 解析 → 原文摘句 → 出处 → 元信息 → 复述提示。
 * 原文摘句与白话解析视觉分离（左侧竖线 + 灰底），防止把白话误当原文。
 */
export function analysisPanel(question) {
  const src = question.source || {};
  const persons = Array.isArray(src.persons) && src.persons.length ? src.persons.join("、") : "—";

  const quoteBlock =
    typeof src.quote === "string" && src.quote
      ? `<blockquote class="quote">${esc(src.quote)}</blockquote>`
      : `<div class="quote quote-empty">原文待补 · 待补底本后填入逐字摘句</div>`;

  const chips = (question.tags || [])
    .map((t) => `<span class="chip">${esc(t)}</span>`)
    .join("");

  return `
    <section class="panel">
      ${verifyBanner(question)}

      <div class="panel-block">
        <h3 class="panel-title">解析</h3>
        <p class="panel-text">${esc(question.analysis)}</p>
      </div>

      <div class="panel-block">
        <h3 class="panel-title">原文依据</h3>
        ${quoteBlock}
      </div>

      <div class="panel-block">
        <h3 class="panel-title">出处</h3>
        <p class="panel-meta">${esc(src.volume || "—")} · ${esc(src.year || "—")}</p>
        <p class="panel-meta">人物：${esc(persons)}</p>
        <p class="panel-meta">事件：${esc(src.event || "—")}</p>
      </div>

      <div class="panel-foot">
        <span class="panel-diff">难度 ${diffStars(question.difficulty)}</span>
        <span class="chips">${chips}</span>
      </div>

      <p class="recall-hint">合上前，用一句话说出这件事的前因后果。</p>
    </section>`;
}
