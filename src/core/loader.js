/**
 * loader.js —— 题库加载与索引构建（M1）
 *
 * 分成两半，这是刻意的：
 *   parseBank(data)          纯函数，零 IO、零 DOM。小程序里可直接复用。
 *   loadQuestionBank(url)    fetch 包装，浏览器专用。移植时这一半换成 require／分包加载。
 *
 * 本文件属于 core 层：不得引用 document / window / localStorage。
 */

import { guardQuestions } from "./guard.js";

/**
 * 把已解析的题库对象整理成运行时结构。
 * @param {object} data 形如 { meta, questions }
 * @returns {{meta: object, questions: Array, index: Map<string, object>,
 *            issues: Array, rawCount: number}}
 */
export function parseBank(data) {
  if (!data || typeof data !== "object") {
    throw new Error("题库格式错误：顶层不是对象");
  }
  if (!Array.isArray(data.questions)) {
    throw new Error("题库格式错误：缺少 questions 数组");
  }

  const { valid, issues } = guardQuestions(data.questions);
  const index = new Map();
  for (const q of valid) index.set(q.id, q);

  return {
    meta: data.meta && typeof data.meta === "object" ? data.meta : {},
    questions: valid,
    index,
    issues,
    rawCount: data.questions.length,
  };
}

/**
 * 浏览器端加载：取 JSON 文本 → 解析 → 组装。
 * 显式 no-store，避免刷新后仍拿到旧题库。
 * @param {string} url
 */
export async function loadQuestionBank(url = "data/questions.v01.json") {
  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new Error(
      `题库请求失败：${e.message}。请确认通过 http://127.0.0.1:端口 访问，而不是直接双击 index.html。`
    );
  }

  if (!res.ok) {
    throw new Error(`题库加载失败：HTTP ${res.status}（${url}）`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`题库 JSON 解析失败：${e.message}`);
  }

  return parseBank(data);
}
