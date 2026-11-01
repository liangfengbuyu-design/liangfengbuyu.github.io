/**
 * guard.js —— 最小防御（M1）
 *
 * 定位：只保证「不白屏」。与 tools/check.py 的 C3 / C4 / C5 三条口径完全一致，
 *       其余 10 条规则只在 check.py 实现，此处不重复，避免规则漂移。
 *
 * 约定（对应 docs/S5-运行方式与校验脚本-v0.1.md 第 2.6 节）：
 *   C3  必填字段无缺失
 *   C4  answer 必须存在于 options[].id
 *   C5  single 恰 4 项 / judge 恰 2 项且为 A「正确」B「错误」
 *
 * 本文件属于 core 层：不得引用 document / window / localStorage。
 */

const REQUIRED_TOP = [
  "id", "type", "stem", "options", "answer",
  "analysis", "source", "difficulty", "tags", "verify",
];

const REQUIRED_SOURCE = ["quote", "volume", "year", "persons", "event"];
const REQUIRED_VERIFY = ["status", "note"];

/**
 * 检查单题。只返回「致命」问题，不评判解析长短、标签合理性等编辑质量问题。
 * @returns {{ok: boolean, label: string, reasons: string[]}}
 */
export function guardQuestion(q, index) {
  const fallback = `第${index + 1}题`;

  if (!q || typeof q !== "object" || Array.isArray(q)) {
    return { ok: false, label: fallback, reasons: ["题目不是对象"] };
  }

  const label = typeof q.id === "string" && q.id ? q.id : fallback;
  const reasons = [];

  // ---- C3 必填字段
  for (const key of REQUIRED_TOP) {
    if (!(key in q)) reasons.push(`缺字段 ${key}`);
  }

  const src = q.source;
  if ("source" in q) {
    if (!src || typeof src !== "object") {
      reasons.push("source 不是对象");
    } else {
      for (const key of REQUIRED_SOURCE) {
        if (!(key in src)) reasons.push(`缺字段 source.${key}`);
      }
    }
  }

  const ver = q.verify;
  if ("verify" in q) {
    if (!ver || typeof ver !== "object") {
      reasons.push("verify 不是对象");
    } else {
      for (const key of REQUIRED_VERIFY) {
        if (!(key in ver)) reasons.push(`缺字段 verify.${key}`);
      }
    }
  }

  // ---- C5 选项结构
  const options = Array.isArray(q.options) ? q.options : null;
  if ("options" in q && !options) {
    reasons.push("options 不是数组");
  }

  const optIds = [];
  if (options) {
    options.forEach((opt, i) => {
      if (!opt || typeof opt !== "object") {
        reasons.push(`第${i + 1}个选项不是对象`);
        return;
      }
      if (typeof opt.id === "string" && opt.id) optIds.push(opt.id);
      else reasons.push(`第${i + 1}个选项缺 id`);
      if (typeof opt.text !== "string" || !opt.text.trim()) {
        reasons.push(`选项 ${opt.id || i + 1} 文案为空`);
      }
    });

    if (q.type === "single" && options.length !== 4) {
      reasons.push(`single 型应有 4 个选项，实际 ${options.length} 个`);
    }
    if (q.type === "judge") {
      if (options.length !== 2) {
        reasons.push(`judge 型应有 2 个选项，实际 ${options.length} 个`);
      } else {
        const a = options[0] || {};
        const b = options[1] || {};
        if (a.id !== "A" || a.text !== "正确" || b.id !== "B" || b.text !== "错误") {
          reasons.push("judge 型选项必须为 A「正确」/ B「错误」");
        }
      }
    }
  }

  if (q.type !== "single" && q.type !== "judge") {
    reasons.push(`type 只能是 single 或 judge，实际 ${JSON.stringify(q.type)}`);
  }

  // ---- C4 答案在选项内
  if ("answer" in q) {
    if (typeof q.answer !== "string") {
      reasons.push("answer 必须是字符串形式的选项 id");
    } else if (options && optIds.length && !optIds.includes(q.answer)) {
      reasons.push(`answer = "${q.answer}"，但选项只有 [${optIds.join(", ")}]`);
    }
  }

  return { ok: reasons.length === 0, label, reasons };
}

/**
 * 批量检查。丢弃有致命问题的题，并记录原因。
 * @returns {{valid: Array, issues: Array<{label: string, reasons: string[]}>}}
 */
export function guardQuestions(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  const valid = [];
  const issues = [];
  const seen = new Set();

  list.forEach((q, index) => {
    const result = guardQuestion(q, index);
    if (result.ok) {
      if (seen.has(q.id)) {
        issues.push({ label: result.label, reasons: ["id 与其他题重复，已跳过"] });
        return;
      }
      seen.add(q.id);
      valid.push(q);
    } else {
      issues.push({ label: result.label, reasons: result.reasons });
    }
  });

  return { valid, issues };
}
