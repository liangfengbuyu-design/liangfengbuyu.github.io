/**
 * dom.js —— 极薄 DOM 助手（M2）
 *
 * 只用字符串操作，不碰 document。这样它虽然属于 UI 层，仍可在 Node 自测里被 import。
 * 遵守 V2：不在这里读写任何业务状态。
 */

/** HTML 转义。所有插入模板的动态文本都必须过一遍。 */
export function esc(value) {
  return String(value === null || value === undefined ? "" : value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

/** 难度星级。 */
export function stars(n) {
  const level = Math.max(1, Math.min(3, Number(n) || 1));
  return "★".repeat(level) + "☆".repeat(3 - level);
}

/** 0 — 1 的比例转百分比整数（无样本时返回 null）。 */
export function pct(ratio) {
  if (ratio === null || ratio === undefined) return null;
  return Math.round(ratio * 100);
}

export function pctText(ratio) {
  const v = pct(ratio);
  return v === null ? "—" : `${v}%`;
}

/** 相对时间：「刚刚」「3 分钟前」「2 天前」。 */
export function relativeTime(ts, now = Date.now()) {
  if (!ts) return "";
  const diff = now - ts;
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;

  if (diff < 0) return "刚刚";
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;

  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
