/**
 * storage.js —— 唯一存储出口（M3）
 *
 * D2 约束：全项目只有这一个文件可以出现 localStorage。
 * pages / core 一律不得直接碰存储。
 *
 * 设计要点：
 *   1. 不认识任何业务类型 —— 只负责「存 JSON / 取 JSON」，默认值由调用方决定。
 *      这样 store 层不依赖 core，将来换 IndexedDB 或小程序 API 时不必改 core。
 *   2. 读失败（数据被污染、手改坏了）时回退到 null，并打警告，绝不抛异常。
 *      宁可让用户丢一次统计，也不要白屏。
 *   3. 写失败（隐私模式、配额超限）返回 false，不抛异常。
 *
 * M3 只落三个 key：meta / stats / wrong。
 * session（会话快照）与 history（答题日志）留给 M4。
 */

const PREFIX = "zj:";

export const KEY = {
  META: `${PREFIX}meta`,
  STATS: `${PREFIX}stats`,
  WRONG: `${PREFIX}wrong`,
  SESSION: `${PREFIX}session`,
  HISTORY: `${PREFIX}history`,
  SETTINGS: `${PREFIX}settings`,
};

export const SCHEMA_VERSION = 1;

let availability = null;

/** localStorage 是否可用（隐私模式、被禁用时返回 false）。 */
export function isAvailable() {
  if (availability !== null) return availability;
  try {
    const probe = `${PREFIX}__probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    availability = true;
  } catch (e) {
    availability = false;
    console.warn("[storage] localStorage 不可用，本次运行不会保存任何数据。", e);
  }
  return availability;
}

function readJSON(key) {
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? null : parsed;
  } catch (e) {
    console.warn(`[storage] ${key} 内容无法解析，已按空数据处理。`, e);
    return null;
  }
}

function writeJSON(key, value) {
  if (!isAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[storage] ${key} 写入失败（可能超出配额或处于隐私模式）。`, e);
    return false;
  }
}

/* ---------------- meta ---------------- */

export function readMeta() {
  return readJSON(KEY.META);
}

/**
 * 确保 meta 存在且版本匹配。
 * 若存的是更高版本（用旧代码打开新数据），只警告不覆盖 —— 避免把新数据写坏。
 * @returns {{readOnly: boolean}}
 */
export function ensureMeta() {
  if (!isAvailable()) return { readOnly: true };

  const meta = readMeta();
  if (!meta) {
    writeJSON(KEY.META, {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    return { readOnly: false };
  }

  if (typeof meta.schemaVersion === "number" && meta.schemaVersion > SCHEMA_VERSION) {
    console.warn(
      `[storage] 数据版本 ${meta.schemaVersion} 高于当前程序 ${SCHEMA_VERSION}，进入只读模式。`
    );
    return { readOnly: true };
  }

  if (meta.schemaVersion !== SCHEMA_VERSION) {
    writeJSON(KEY.META, {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
  }

  return { readOnly: false };
}

/* ---------------- stats / wrong ---------------- */

export function readStats() {
  return readJSON(KEY.STATS);
}

export function writeStats(stats) {
  return writeJSON(KEY.STATS, stats);
}

export function readWrong() {
  return readJSON(KEY.WRONG);
}

export function writeWrong(book) {
  return writeJSON(KEY.WRONG, book);
}

/* ---------------- session ---------------- */

export function readSession() {
  return readJSON(KEY.SESSION);
}

export function writeSession(session) {
  return writeJSON(KEY.SESSION, session);
}

export function clearSession() {
  if (!isAvailable()) return false;
  try {
    window.localStorage.removeItem(KEY.SESSION);
    return true;
  } catch (e) {
    console.warn("[storage] session 清除失败。", e);
    return false;
  }
}

/* ---------------- history ---------------- */

export function readHistory() {
  const value = readJSON(KEY.HISTORY);
  return Array.isArray(value) ? value : null;
}

export function writeHistory(list) {
  return writeJSON(KEY.HISTORY, Array.isArray(list) ? list : []);
}

/* ---------------- settings ---------------- */

export function readSettings() {
  return readJSON(KEY.SETTINGS);
}

export function writeSettings(settings) {
  return writeJSON(KEY.SETTINGS, settings);
}

/* ---------------- 批量操作 ---------------- */

/** 导出全部数据（备份 / 迁移用）。 */
export function readAll() {
  return {
    meta: readMeta(),
    stats: readStats(),
    wrong: readWrong(),
    history: readHistory(),
    settings: readSettings(),
  };
}

/** 导入：整体覆盖（合并策略留到以后需要时再加）。 */
export function writeAll(data) {
  if (!data || typeof data !== "object") return false;
  let ok = true;
  if (data.stats) ok = writeStats(data.stats) && ok;
  if (data.wrong) ok = writeWrong(data.wrong) && ok;
  if (Array.isArray(data.history)) ok = writeHistory(data.history) && ok;
  if (data.settings) ok = writeSettings(data.settings) && ok;
  return ok;
}

/** 清空本应用的全部 key（不动同域其他应用的数据）。 */
export function clearAll() {
  if (!isAvailable()) return false;
  try {
    for (const key of Object.values(KEY)) {
      window.localStorage.removeItem(key);
    }
    availability = null;
    return true;
  } catch (e) {
    console.warn("[storage] 清空失败。", e);
    return false;
  }
}
