/**
 * backup.js —— 备份文件的组装与校验（M4）
 *
 * 只负责数据层面：打包成对象、校验外部文件是否可用。
 * 真正的下载与读文件属于 DOM 操作，放在 settings 页里做。
 *
 * D1：零 DOM / 零存储。
 */

export const BACKUP_KIND = "zztj-quiz-backup";
export const BACKUP_VERSION = 1;

/**
 * 组装导出对象。
 * @param {{stats: object, wrong: object, history: Array, settings: object}} state
 */
export function buildBackup(state) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stats: state.stats || null,
    wrong: state.wrong || {},
    history: Array.isArray(state.history) ? state.history : [],
    settings: state.settings || null,
  };
}

/**
 * 校验外部文件内容。
 * @param {*} obj 已 JSON.parse 的对象
 * @returns {string|null} 出错原因；null 表示可用
 */
export function validateBackup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return "文件内容不是一个对象，可能选错了文件。";
  }

  if (obj.kind && obj.kind !== BACKUP_KIND) {
    return "这不是本应用导出的备份文件。";
  }

  if (typeof obj.version === "number" && obj.version > BACKUP_VERSION) {
    return `备份版本 ${obj.version} 高于当前程序（${BACKUP_VERSION}），请更新程序后再导入。`;
  }

  if (!obj.stats || typeof obj.stats !== "object") {
    return "备份中缺少 stats（累计统计）。";
  }
  if (typeof obj.stats.totalAnswered !== "number") {
    return "stats 结构异常：缺少 totalAnswered。";
  }

  if (!obj.wrong || typeof obj.wrong !== "object" || Array.isArray(obj.wrong)) {
    return "备份中缺少 wrong（错题本），或结构不是对象。";
  }

  if (obj.history !== undefined && !Array.isArray(obj.history)) {
    return "history 字段存在但不是数组。";
  }

  return null;
}

/** 导入时的摘要，用于二次确认弹窗。 */
export function describeBackup(obj) {
  if (!obj) return "";
  const answered = obj.stats && obj.stats.totalAnswered ? obj.stats.totalAnswered : 0;
  const wrong = obj.wrong ? Object.keys(obj.wrong).length : 0;
  const history = Array.isArray(obj.history) ? obj.history.length : 0;
  const when = obj.exportedAt ? String(obj.exportedAt).slice(0, 10) : "未知日期";
  return `导出于 ${when}：累计 ${answered} 题，错题 ${wrong} 条，日志 ${history} 条。`;
}
