/**
 * date.js —— 日期工具（M4）
 *
 * 抽出来是因为 stats（连续学习天数）与 history（今日进度）都要用，
 * 放在任一方都会造成无谓的模块依赖。
 *
 * 一律使用本地时区，不碰 UTC —— 用户感知的「今天」是本地的今天。
 */

export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function prevDayKey(key) {
  const parts = String(key).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() - 1);
  return dayKey(dt);
}

/** 时间戳是否落在指定日期。 */
export function isOnDay(ts, key) {
  if (typeof ts !== "number") return false;
  return dayKey(new Date(ts)) === key;
}
