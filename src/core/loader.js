/**
 * loader.js —— 题库加载与索引构建（M6-A 多卷结构 / M6-D 按需加载）
 *
 * 两段式加载：
 *   1. 启动只读 data/meta.json（几 KB），拿到卷清单、题数、每卷事件标签。
 *      首页、范围页、统计页全部靠它，不需要任何卷文件。
 *   2. 真正要答题时，才下载对应的卷（loadVolumes），并缓存在内存里。
 *
 * 这样 5 卷和 78 卷的首屏时间几乎一样，代价只是点「开始」时多等一两百毫秒。
 *
 * 分成两半，这是刻意的：
 *   parseIndex / parseVolume / emptyBank / attachVolume   纯函数，零 IO、零 DOM。小程序里可直接复用。
 *   loadIndex / loadVolume / loadVolumes                  fetch 包装，浏览器专用。
 *
 * 本文件属于 core 层：不得引用 document / window / localStorage。
 */

import { guardQuestions } from "./guard.js";

/* ------------------------------------------------------------ 纯函数 */

/**
 * 整理总索引。索引里的 count / pending / events 由 tools/build_index.py 自动生成。
 * @param {object} data 形如 { title, edition, volumes: [...] }
 */
export function parseIndex(data) {
  if (!data || typeof data !== "object") {
    throw new Error("题库索引格式错误：顶层不是对象");
  }
  if (!Array.isArray(data.volumes) || data.volumes.length === 0) {
    throw new Error("题库索引格式错误：volumes 为空");
  }

  const volumes = data.volumes
    .filter((v) => v && typeof v === "object" && typeof v.id === "string")
    .map((v) => ({
      id: v.id,
      name: typeof v.name === "string" ? v.name : v.id,
      yearFrom: typeof v.yearFrom === "string" ? v.yearFrom : "",
      yearTo: typeof v.yearTo === "string" ? v.yearTo : "",
      file: typeof v.file === "string" ? v.file : `data/questions/${v.id}.json`,
      count: Number(v.count) || 0,
      pending: Number(v.pending) || 0,
      /* 老索引没有这个字段，退回空数组；此时「按事件刷」要等卷加载后才有标签 */
      events: Array.isArray(v.events) ? v.events.filter((e) => typeof e === "string") : [],
    }));

  if (!volumes.length) {
    throw new Error("题库索引格式错误：没有可用的卷");
  }

  return {
    title: typeof data.title === "string" ? data.title : "资治通鉴",
    edition: typeof data.edition === "string" ? data.edition : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    tagTypes: Array.isArray(data.tagTypes) ? data.tagTypes.slice() : [],
    /* 事件 → 题数，由 build_index.py 数出来。有了它，首页不必下载任何卷 */
    eventCounts:
      data.eventCounts && typeof data.eventCounts === "object" ? { ...data.eventCounts } : {},
    volumes,
    totals: {
      volumes: volumes.length,
      questions: volumes.reduce((s, v) => s + v.count, 0),
      pending: volumes.reduce((s, v) => s + v.pending, 0),
    },
  };
}

/**
 * 整理单卷。题目若过不了最小防御，该题被丢弃并记入 issues。
 * @param {object} data 形如 { meta, questions }
 * @param {object} [volumeInfo] 索引里的卷信息，用于补全 meta
 */
export function parseVolume(data, volumeInfo = null) {
  if (!data || typeof data !== "object") {
    throw new Error("卷文件格式错误：顶层不是对象");
  }
  if (!Array.isArray(data.questions)) {
    throw new Error("卷文件格式错误：缺少 questions 数组");
  }

  const rawMeta = data.meta && typeof data.meta === "object" ? data.meta : {};
  const { valid, issues } = guardQuestions(data.questions);

  const index = new Map();
  for (const q of valid) index.set(q.id, q);

  const volumeId = rawMeta.volumeId || (volumeInfo && volumeInfo.id) || "";

  return {
    volumeId,
    meta: {
      ...rawMeta,
      volumeId,
      volumeName: rawMeta.volumeName || (volumeInfo && volumeInfo.name) || volumeId,
      yearFrom: rawMeta.yearFrom || (volumeInfo && volumeInfo.yearFrom) || "",
      yearTo: rawMeta.yearTo || (volumeInfo && volumeInfo.yearTo) || "",
      tagGroups: {
        events: (rawMeta.tagGroups && rawMeta.tagGroups.events) || [],
        types: (rawMeta.tagGroups && rawMeta.tagGroups.types) || [],
      },
    },
    questions: valid,
    index,
    issues,
    rawCount: data.questions.length,
  };
}

/**
 * 只含索引的轻量 bank —— 启动时用它，此时没有任何题目。
 * questions 为空、index 为空，但 totals / volumes / volumeEvents 都齐备。
 */
export function emptyBank(indexData) {
  const volumeEvents = {};
  const volumeCounts = {};
  for (const v of indexData.volumes) {
    volumeEvents[v.id] = v.events.slice();
    volumeCounts[v.id] = v.count;
  }

  return {
    meta: {
      title: indexData.title,
      edition: indexData.edition,
      updatedAt: indexData.updatedAt,
      tagGroups: {
        events: collectEvents(indexData.volumes.map((v) => v.id), volumeEvents),
        types: indexData.tagTypes.slice(),
      },
      totals: indexData.totals,
    },
    volumes: indexData.volumes,
    volumeEvents,
    volumeCounts,
    eventCounts: { ...indexData.eventCounts },
    loaded: [],
    questions: [],
    index: new Map(),
    issues: [],
    rawCount: 0,
  };
}

function collectEvents(ids, volumeEvents) {
  const out = [];
  for (const id of ids) {
    for (const ev of volumeEvents[id] || []) {
      if (!out.includes(ev)) out.push(ev);
    }
  }
  return out;
}

/**
 * 把一卷并入 bank，返回新 bank（不改入参，D3）。
 * 重复并入同一卷会被忽略 —— 按需加载时同一卷可能被请求两次。
 */
export function attachVolume(bank, vol) {
  if (!vol || !vol.meta || !vol.meta.volumeId) return bank;
  const vid = vol.meta.volumeId;
  if (bank.loaded.includes(vid)) return bank;

  const questions = bank.questions.slice();
  const index = new Map(bank.index);
  const issues = bank.issues.slice();
  const vname = vol.meta.volumeName;

  for (const q of vol.questions) {
    /* 题目本身不带卷次字段，运行时注入，不写回 JSON */
    const withVol = { ...q, vol: vid, volName: vname };
    questions.push(withVol);
    index.set(withVol.id, withVol);
  }
  for (const issue of vol.issues) issues.push(issue);

  const loaded = bank.loaded.concat([vid]);
  const volumeEvents = { ...bank.volumeEvents };
  /* 索引里已登记事件就以索引为准；老索引没登记时才用卷文件补齐 */
  if (!(volumeEvents[vid] && volumeEvents[vid].length)) {
    volumeEvents[vid] = (vol.meta.tagGroups.events || []).slice();
  }

  const volumeCounts = { ...bank.volumeCounts };
  volumeCounts[vid] = vol.questions.length;

  /* 事件标签必须始终是「全库」的：空 bank 时有 20 个，载入一卷后仍应是 20 个，
     否则「按事件刷」的标签会随加载进度忽多忽少。
     索引带 events 就以索引为准；老索引（无 events）才退回按已加载卷现算。 */
  const events = bank.meta.tagGroups.events.length
    ? bank.meta.tagGroups.events.slice()
    : collectEvents(loaded, volumeEvents);

  return {
    ...bank,
    meta: {
      ...bank.meta,
      tagGroups: {
        events,
        types: bank.meta.tagGroups.types.slice(),
      },
    },
    volumeEvents,
    volumeCounts,
    loaded,
    questions,
    index,
    issues,
    rawCount: questions.length + issues.length,
  };
}

/**
 * 一次性把若干卷装进索引（供测试与兼容旧调用）。
 */
export function mergeBank(indexData, loadedVolumes) {
  let bank = emptyBank(indexData);
  for (const vol of loadedVolumes) bank = attachVolume(bank, vol);
  return bank;
}

/** 给出还没加载的卷 id（过滤掉索引里不存在的）。 */
export function missingVolumes(bank, ids) {
  const wanted = Array.isArray(ids) ? ids : [];
  const known = new Set(bank.volumes.map((v) => v.id));
  return wanted.filter((id) => known.has(id) && !bank.loaded.includes(id));
}

/** 从题号推断卷 id：V02-017 → v02。推断不出返回 null。 */
export function volumeOfQid(qid) {
  const m = /^V(\d+)-/.exec(String(qid || ""));
  if (!m) return null;
  return "v" + m[1];
}

/* ------------------------------------------------------------ fetch 包装 */

async function fetchJSON(url) {
  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new Error(
      `请求失败：${url}（${e.message}）。请确认通过 http://127.0.0.1:端口 或 https 访问，而不是直接双击 index.html。`
    );
  }
  if (!res.ok) {
    throw new Error(`加载失败：HTTP ${res.status}（${url}）`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${url} 不是合法 JSON：${e.message}`);
  }
}

export async function loadIndex(url = "data/meta.json") {
  return parseIndex(await fetchJSON(url));
}

export async function loadVolume(volume) {
  const file = typeof volume === "string" ? volume : volume.file;
  const info = typeof volume === "string" ? null : volume;
  return parseVolume(await fetchJSON(file), info);
}

/**
 * 按需加载：把 bank 里还没下载的卷补齐，返回新 bank。
 *
 * 单卷失败不抛出，只记进 failures —— 一卷坏了不该让整个应用打不开。
 * 但若一卷都没加载成功且原本就是空的，由调用方决定怎么提示。
 *
 * @returns {{bank: object, failures: Array<{id: string, error: Error}>}}
 */
export async function loadVolumes(bank, ids) {
  const need = missingVolumes(bank, ids);
  if (!need.length) return { bank, failures: [] };

  const byId = new Map(bank.volumes.map((v) => [v.id, v]));
  const results = await Promise.allSettled(need.map((id) => loadVolume(byId.get(id))));

  let next = bank;
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") next = attachVolume(next, r.value);
    else failures.push({ id: need[i], error: r.reason });
  });

  return { bank: next, failures };
}

/** 加载全部卷（离线预取、导出等场景用，普通浏览不要调）。 */
export async function loadAllVolumes(bank) {
  return loadVolumes(bank, bank.volumes.map((v) => v.id));
}

/**
 * 一次性加载索引与全部卷 —— 保留给测试与旧调用。
 * 应用内已改为「先 emptyBank 再按需 loadVolumes」，不要在新代码里用这个。
 */
export async function loadQuestionBank(indexUrl = "data/meta.json") {
  const indexData = await loadIndex(indexUrl);
  const bank = emptyBank(indexData);
  const { bank: full, failures } = await loadAllVolumes(bank);

  if (!full.loaded.length) {
    throw new Error(
      `所有卷都加载失败。第一卷：${failures[0] ? failures[0].error.message : "未知原因"}`
    );
  }
  if (failures.length) {
    console.warn(`[loader] ${failures.length} 卷加载失败，已跳过：`, failures.map((f) => f.id));
  }
  return full;
}
