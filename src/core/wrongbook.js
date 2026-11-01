/**
 * wrongbook.js —— 错题本规则（M3）
 *
 * 规则（来自 PRD FR-6）：
 *   - 答错 → 入册，wrongCount + 1，streak 归零
 *   - 答对且该题在册 → streak + 1；达到 2 次即自动出册
 *   - 答对且该题不在册 → 无影响
 *   - 跳过 → 完全不参与（不算作答，也不进错题本）
 *
 * D1：零 DOM / 零存储。
 * D3：纯函数，一律返回新对象，绝不修改入参。
 */

export const PASS_STREAK = 2;

export function emptyBook() {
  return {};
}

/**
 * 应用一次作答结果。
 * @param {object} book  Record<qid, WrongEntry>
 * @param {string} qid
 * @param {boolean} correct
 * @param {number} [now] 时间戳，便于测试注入
 * @returns 新 book
 */
export function applyAnswer(book, qid, correct, now = Date.now()) {
  if (!qid) return book;
  const base = book || {};
  const current = base[qid];

  if (!correct) {
    const entry = current || {
      wrongCount: 0,
      streak: 0,
      firstWrongAt: now,
      lastWrongAt: now,
      lastResult: "wrong",
    };
    return {
      ...base,
      [qid]: {
        ...entry,
        wrongCount: entry.wrongCount + 1,
        streak: 0,
        lastResult: "wrong",
        lastWrongAt: now,
      },
    };
  }

  // 答对：不在册则无需处理
  if (!current) return base;

  const streak = current.streak + 1;
  if (streak >= PASS_STREAK) {
    const next = { ...base };
    delete next[qid];
    return next;
  }

  return {
    ...base,
    [qid]: { ...current, streak, lastResult: "correct" },
  };
}

/** 手动移出错题本（不计入连对，也不改变其他题）。 */
export function removeFromBook(book, qid) {
  if (!book || !book[qid]) return book;
  const next = { ...book };
  delete next[qid];
  return next;
}

/** 错题清单，按最近答错时间降序。 */
export function listWrong(book) {
  const base = book || {};
  return Object.keys(base)
    .map((qid) => ({ qid, ...base[qid] }))
    .sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
}

export function countWrong(book) {
  return book ? Object.keys(book).length : 0;
}

export function wrongIds(book) {
  return Object.keys(book || {});
}

/**
 * 连对进度展示数据。
 * @returns {{done: number, total: number, label: string}}
 */
export function streakProgress(entry) {
  const done = Math.max(0, Math.min(PASS_STREAK, (entry && entry.streak) || 0));
  return {
    done,
    total: PASS_STREAK,
    label: `${done}/${PASS_STREAK}`,
  };
}
