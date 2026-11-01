/**
 * review.js —— 判分（M2）
 *
 * 两种题型共用一套逻辑：用户的选项 id === 题目 answer 即为正确。
 * 判断题在数据结构上与二选一单选同构（见题库 JSON 格式规范 5.1），故此处不需要分支。
 *
 * D1：零 DOM / 零存储。D3：无副作用，不改入参。
 */

/**
 * @param {object} question
 * @param {string|null} selectedId
 * @returns {{correct: boolean, correctId: string|null}}
 */
export function judge(question, selectedId) {
  if (!question) return { correct: false, correctId: null };
  return {
    correct: selectedId === question.answer,
    correctId: question.answer,
  };
}

/**
 * 逐个选项的展示状态，供视图层使用。
 * @returns {Array<{id: string, text: string, correct: boolean,
 *                  picked: boolean, state: "idle"|"picked"|"correct"|"wrong"}>}
 */
export function optionStates(question, selectedId, revealed) {
  if (!question || !Array.isArray(question.options)) return [];
  return question.options.map((opt) => {
    const isAnswer = opt.id === question.answer;
    const isPicked = opt.id === selectedId;

    let state = "idle";
    if (revealed) {
      if (isAnswer) state = "correct";
      else if (isPicked) state = "wrong";
    } else if (isPicked) {
      state = "picked";
    }

    return { id: opt.id, text: opt.text, correct: isAnswer, picked: isPicked, state };
  });
}
