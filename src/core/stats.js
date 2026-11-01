/**
 * stats.js —— 累计统计（M3）
 *
 * 只存累加计数，不存推导结果（L1 原则）。正确率、排行、差异提示一律现算。
 *
 * D1：零 DOM / 零存储。D3：纯函数，返回新对象，不改入参。
 */

import { dayKey, prevDayKey } from "./date.js";

export { dayKey };

export function emptyStats() {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    byType: {
      single: { a: 0, c: 0 },
      judge: { a: 0, c: 0 },
    },
    byTag: {},
    firstStudyDate: null,
    lastStudyDate: null,
    streakDays: 0,
  };
}

/** 本地日期键 YYYY-MM-DD。实现见 core/date.js。 */

/**
 * 累加一次作答。跳过题不要调用本函数。
 * @param {object} stats
 * @param {object} question
 * @param {boolean} correct
 * @param {string} [today] 便于测试注入
 */
export function applyAnswer(stats, question, correct, today = dayKey()) {
  const base = stats || emptyStats();

  const next = {
    ...base,
    byType: {
      single: { ...(base.byType.single || { a: 0, c: 0 }) },
      judge: { ...(base.byType.judge || { a: 0, c: 0 }) },
    },
    byTag: { ...base.byTag },
    totalAnswered: (base.totalAnswered || 0) + 1,
    totalCorrect: (base.totalCorrect || 0) + (correct ? 1 : 0),
  };

  const type = question && question.type;
  if (next.byType[type]) {
    next.byType[type].a += 1;
    if (correct) next.byType[type].c += 1;
  }

  const tag = question && question.source && question.source.event;
  if (typeof tag === "string" && tag) {
    const cur = next.byTag[tag] || { a: 0, c: 0 };
    next.byTag[tag] = { a: cur.a + 1, c: cur.c + (correct ? 1 : 0) };
  }

  // 连续学习天数：同一天不重复计；隔一天则 +1；断档则重置为 1
  if (next.lastStudyDate !== today) {
    if (!next.firstStudyDate) next.firstStudyDate = today;
    if (next.lastStudyDate && prevDayKey(today) === next.lastStudyDate) {
      next.streakDays = (next.streakDays || 0) + 1;
    } else {
      next.streakDays = 1;
    }
    next.lastStudyDate = today;
  }

  return next;
}

export function accuracy(c, a) {
  return a ? c / a : null;
}

export function overallAccuracy(stats) {
  if (!stats) return null;
  return accuracy(stats.totalCorrect, stats.totalAnswered);
}

export function typeAccuracy(stats, type) {
  if (!stats || !stats.byType || !stats.byType[type]) return null;
  const t = stats.byType[type];
  return accuracy(t.c, t.a);
}

/**
 * 标签排行。样本充足的按正确率升序在前，样本不足的排在后面并标记。
 * @param {number} minSample 少于这个样本量视为「样本不足」
 */
export function tagRanking(stats, minSample = 3) {
  if (!stats || !stats.byTag) return [];
  return Object.keys(stats.byTag)
    .map((tag) => {
      const { a, c } = stats.byTag[tag];
      return { tag, a, c, accuracy: accuracy(c, a), enough: a >= minSample };
    })
    .sort((x, y) => {
      if (x.enough !== y.enough) return x.enough ? -1 : 1;
      const ax = x.accuracy === null ? 1 : x.accuracy;
      const ay = y.accuracy === null ? 1 : y.accuracy;
      if (ax !== ay) return ax - ay;
      return y.a - x.a;
    });
}

/**
 * 判断题与单选题正确率差异过大 → 提示可能存在猜测。
 * 仅当两种题型样本都够时才判断，否则返回 null。
 */
export function guessWarning(stats, threshold = 0.1, minSample = 3) {
  if (!stats || !stats.byType) return null;
  const s = stats.byType.single;
  const j = stats.byType.judge;
  if (!s || !j) return null;
  if (s.a < minSample || j.a < minSample) return null;

  const sa = accuracy(s.c, s.a);
  const ja = accuracy(j.c, j.a);
  if (sa === null || ja === null) return null;

  const gap = ja - sa;
  return gap > threshold ? { single: sa, judge: ja, gap } : null;
}

/** 最弱的若干标签（仅供结算页使用，只看本轮）。 */
export function weakest(byTag, n = 3, minSample = 1) {
  return Object.keys(byTag || {})
    .map((tag) => {
      const { a, c } = byTag[tag];
      return { tag, a, c, accuracy: accuracy(c, a) };
    })
    .filter((t) => t.a >= minSample)
    .sort((x, y) => (x.accuracy === null ? 1 : x.accuracy) - (y.accuracy === null ? 1 : y.accuracy))
    .slice(0, n);
}
