/**
 * derive.js —— L3 派生值（M1 起用）
 *
 * 约定：派生值一律现算，永不写入存储。见页面与数据结构设计 v0.1 第 2.1 节。
 * 本文件属于 core 层：纯函数，零 IO、零 DOM。
 */

/**
 * 汇总题库结构，供 M1 验证页与 M3 统计页使用。
 * @param {object} bank parseBank() 的返回值
 */
export function summarize(bank) {
  const qs = bank.questions;
  const meta = bank.meta || {};

  const byType = { single: 0, judge: 0 };
  const byDifficulty = { 1: 0, 2: 0, 3: 0 };
  let pending = 0;
  let emptyQuote = 0;

  for (const q of qs) {
    if (q.type in byType) byType[q.type] += 1;
    if (q.difficulty in byDifficulty) byDifficulty[q.difficulty] += 1;
    if (q.verify && q.verify.status === "pending") pending += 1;
    if (!q.source || q.source.quote === null) emptyQuote += 1;
  }

  /* 只统计「当前已加载题目里真的有题」的事件。
     索引里的全库事件清单在 meta.tagGroups.events 里，两者用途不同：
     那个用于「按事件刷」的标签列表，这个用于校准题量分布。 */
  const events = ((meta.tagGroups && meta.tagGroups.events) || [])
    .map((tag) => {
      const count = qs.filter((q) => q.source && q.source.event === tag).length;
      return { tag, count };
    })
    .filter((e) => e.count > 0);

  return {
    total: qs.length,
    rawCount: bank.rawCount,
    byType,
    byDifficulty,
    pending,
    verified: qs.length - pending,
    emptyQuote,
    withQuote: qs.length - emptyQuote,
    events,
    issues: bank.issues || [],
  };
}
