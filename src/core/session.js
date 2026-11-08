/**
 * session.js —— 会话生命周期（M2）
 *
 * 遵守 D3：所有函数不改入参，一律返回新对象。
 * 遵守 D1：零 DOM、零存储引用。
 *
 * 会话状态结构见 docs/页面与数据结构设计-v0.1.md 第 2.2 节。
 * 注意：M2 阶段会话只存在内存里，刷新即丢。持久化（zj:session 快照）在 M4 实现。
 */

export const MODE = {
  SEQUENCE: "sequence",
  RANDOM: "random",
  BY_TAG: "byTag",
  WRONG_ONLY: "wrongOnly",
  /* 自定义范围：按卷次勾选（M6-B）。与 RANDOM 的区别只是「池子由用户指定」。 */
  CUSTOM: "custom",
};

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** 归一化卷次筛选：空数组 / null / undefined 都视为「不限」。 */
export function normalizeVolumeIds(volumeIds) {
  if (!Array.isArray(volumeIds)) return [];
  const seen = new Set();
  const out = [];
  for (const v of volumeIds) {
    if (typeof v !== "string" || !v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * 生成一轮会话。
 * @param {object} opts
 * @param {Array}  opts.questions 全部题目
 * @param {string} opts.mode      MODE 之一
 * @param {string} [opts.tag]     BY_TAG 模式下的标签
 * @param {number} [opts.limit]   0 表示不限（不截断）
 * @param {Array<string>} [opts.onlyIds]   WRONG_ONLY 模式传入题目 id 列表
 * @param {Array<string>} [opts.volumeIds] 只取这些卷的题（CUSTOM 及其他模式都可用）
 */
export function createSession({
  questions,
  mode = MODE.SEQUENCE,
  tag = null,
  limit = 0,
  onlyIds = null,
  volumeIds = null,
}) {
  let pool = Array.isArray(questions) ? questions.slice() : [];
  const vols = normalizeVolumeIds(volumeIds);

  /* 卷次筛选对所有模式生效：即便是「随机刷」，也只在选中的卷里随机 */
  if (vols.length) {
    const wanted = new Set(vols);
    /* 题目缺 vol 字段（老数据）时放行，宁可多给一题，也不要静默丢题 */
    pool = pool.filter((q) => !q.vol || wanted.has(q.vol));
  }

  if (mode === MODE.WRONG_ONLY) {
    const wanted = new Set(Array.isArray(onlyIds) ? onlyIds : []);
    pool = pool.filter((q) => wanted.has(q.id));
  } else if (mode === MODE.BY_TAG) {
    pool = pool.filter((q) => Array.isArray(q.tags) && tag && q.tags.includes(tag));
  }

  /* RANDOM / BY_TAG / CUSTOM 都要打乱 —— CUSTOM 的「跨卷混合随机」就由此实现 */
  if (mode === MODE.RANDOM || mode === MODE.BY_TAG || mode === MODE.CUSTOM) {
    pool = shuffle(pool);
  }

  if (limit > 0) {
    pool = pool.slice(0, limit);
  }

  return {
    sessionId: String(Date.now()),
    mode,
    filter: { tag: tag || null, limit: limit || 0, volumeIds: vols },
    queue: pool.map((q) => q.id),
    cursor: 0,
    answers: {},
    startedAt: Date.now(),
    finishedAt: null,
  };
}

/** 当前题 id；越界或空会话返回 null。 */
export function currentId(session) {
  if (!session || !Array.isArray(session.queue)) return null;
  if (session.cursor < 0 || session.cursor >= session.queue.length) return null;
  return session.queue[session.cursor];
}

/** 当前题序号（1 起）；越界返回 0。 */
export function currentNo(session) {
  const id = currentId(session);
  return id === null ? 0 : session.cursor + 1;
}

/**
 * 记录一次作答。先跳过用 { skipped: true }。
 * @returns 新 session
 */
export function recordAnswer(session, qid, { selected = null, correct = false, skipped = false } = {}) {
  if (!session || !qid) return session;
  return {
    ...session,
    answers: {
      ...session.answers,
      [qid]: { selected, correct, skipped, answeredAt: Date.now() },
    },
  };
}

/** 光标前进一位。走到队尾时写入 finishedAt。 */
export function advance(session) {
  if (!session) return session;
  const cursor = session.cursor + 1;
  const finished = cursor >= session.queue.length;
  return {
    ...session,
    cursor,
    finishedAt: finished ? Date.now() : null,
  };
}

export function isFinished(session) {
  if (!session) return true;
  return session.cursor >= session.queue.length;
}

export function isLastQuestion(session) {
  if (!session) return false;
  return session.cursor + 1 >= session.queue.length;
}

/**
 * 汇总本轮结果（L3 派生值，现算不存）。
 * 跳过题不计入正确率分母，也不进错题清单。
 */
export function summarizeSession(session, qIndex) {
  const byType = { single: { a: 0, c: 0 }, judge: { a: 0, c: 0 } };
  const byTag = {};
  const wrongIds = [];

  let answered = 0;
  let correct = 0;
  let skipped = 0;

  for (const qid of Object.keys(session.answers)) {
    const rec = session.answers[qid];
    if (rec.skipped) {
      skipped += 1;
      continue;
    }
    answered += 1;
    if (rec.correct) correct += 1;
    else wrongIds.push(qid);

    const q = qIndex ? qIndex.get(qid) : null;
    if (!q) continue;

    if (byType[q.type]) {
      byType[q.type].a += 1;
      if (rec.correct) byType[q.type].c += 1;
    }

    const ev = q.source && q.source.event;
    if (typeof ev === "string" && ev) {
      if (!byTag[ev]) byTag[ev] = { a: 0, c: 0 };
      byTag[ev].a += 1;
      if (rec.correct) byTag[ev].c += 1;
    }
  }

  return {
    total: session.queue.length,
    answered,
    correct,
    wrong: answered - correct,
    skipped,
    accuracy: answered ? correct / answered : null,
    byType,
    byTag,
    wrongIds,
  };
}

/** 按正确率升序取最弱标签；样本 < minSample 的不参与排名。 */
export function weakestTags(byTag, n = 3, minSample = 2) {
  return Object.keys(byTag)
    .map((tag) => ({ tag, ...byTag[tag] }))
    .filter((t) => t.a >= minSample)
    .map((t) => ({ ...t, accuracy: t.c / t.a }))
    .sort((x, y) => x.accuracy - y.accuracy)
    .slice(0, n);
}

/**
 * 从存储里恢复一个会话（M4）。
 *
 * 三件必须做的事：
 *   1. 丢弃题库中已不存在的 qid（题库更新后旧快照会失效）
 *   2. 同样清理 answers 里失效的记录
 *   3. 把光标推到第一个尚未作答的题上 —— 因为退出时可能停在已判定的题上
 *
 * @param {object} raw 存储里读出的原始对象
 * @param {Set<string>|Map<string, *>} validIds 当前题库的有效 id 集合
 * @returns 可用的 session；无法恢复时返回 null
 */
export function restoreSession(raw, validIds) {
  if (!raw || typeof raw !== "object") return null;
  if (!Array.isArray(raw.queue) || !raw.queue.length) return null;

  const has = (id) => (validIds && typeof validIds.has === "function" ? validIds.has(id) : true);

  const queue = raw.queue.filter((id) => typeof id === "string" && has(id));
  if (!queue.length) return null;

  const answers = {};
  const srcAnswers = raw.answers && typeof raw.answers === "object" ? raw.answers : {};
  for (const qid of Object.keys(srcAnswers)) {
    if (has(qid)) answers[qid] = srcAnswers[qid];
  }

  let cursor = 0;
  while (cursor < queue.length && answers[queue[cursor]]) {
    cursor += 1;
  }

  // 全部答完，没有恢复的意义
  if (cursor >= queue.length) return null;

  return {
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : String(Date.now()),
    mode: raw.mode || MODE.SEQUENCE,
    filter:
      raw.filter && typeof raw.filter === "object"
        ? { tag: null, limit: 0, volumeIds: [], ...raw.filter }
        : { tag: null, limit: 0, volumeIds: [] },
    queue,
    cursor,
    answers,
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : Date.now(),
    finishedAt: null,
  };
}

/** 已作答题数（含跳过），用于首页「继续上次 · 已完成 N/M」。 */
export function answeredCount(session) {
  if (!session || !session.answers) return 0;
  return Object.keys(session.answers).length;
}
