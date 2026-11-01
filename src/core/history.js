/**
 * history.js —— 答题日志（M4）
 *
 * 环形缓冲：只保留最近 MAX_HISTORY 条，超出后丢弃最早的。
 * 只存 qid 与结果，**不存题干文字** —— 题干在题库里，存副本会导致题库更新后日志与事实不符。
 *
 * D1：零 DOM / 零存储。D3：纯函数，返回新数组。
 */

import { isOnDay } from "./date.js";

export const MAX_HISTORY = 200;

export function emptyHistory() {
  return [];
}

/**
 * 追加一条记录并裁剪。
 * @param {Array} history
 * @param {{qid: string, selected: string|null, correct: boolean, skipped: boolean, ts: number, mode: string}} entry
 */
export function appendEntry(history, entry) {
  const list = Array.isArray(history) ? history : [];
  const next = list.concat([entry]);
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/** 某题最近一次作答记录（新→旧查找）。 */
export function lastAnswerFor(history, qid) {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i] && history[i].qid === qid) return history[i];
  }
  return null;
}

/** 某题的全部作答记录（旧→新）。 */
export function entriesFor(history, qid) {
  if (!Array.isArray(history)) return [];
  return history.filter((e) => e && e.qid === qid);
}

/** 总作答次数（含跳过）。 */
export function totalEntries(history) {
  return Array.isArray(history) ? history.length : 0;
}

/** 指定日期（YYYY-MM-DD）的作答条数，用于首页今日进度。 */
export function countOnDay(history, key) {
  if (!Array.isArray(history)) return 0;
  return history.filter((e) => e && isOnDay(e.ts, key)).length;
}

/** 某日答对数。 */
export function correctOnDay(history, key) {
  if (!Array.isArray(history)) return 0;
  return history.filter((e) => e && isOnDay(e.ts, key) && e.correct).length;
}
