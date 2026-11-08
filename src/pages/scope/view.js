/**
 * 自定义范围选择页（S7）—— 勾选卷次后开始答题（M6-B）
 *
 * 遵守 V2：选中状态只在闭包变量 selected 里，不用 checkbox 的原生 checked 做真源。
 * 页面所有按钮都是 data-action，交给 main.js 的全局事件委托处理。
 */

import { esc } from "../../ui/dom.js";
import { normalizeVolumeIds } from "../../core/session.js";

const LIMITS = [
  { value: 10, label: "10 题" },
  { value: 15, label: "15 题" },
  { value: 20, label: "20 题" },
  { value: 30, label: "30 题" },
  { value: 0, label: "不限" },
];

/**
 * @param {object} opts
 * @param {object} opts.bank       运行时题库（需要 volumes / volumeEvents）
 * @param {Array<string>} [opts.initialVolumes] 上次选中的卷（来自 settings）
 * @param {number} [opts.initialLimit]          上次的题量
 * @param {Function} opts.onStart  ({ volumeIds, limit }) => void
 * @param {Function} opts.onBack   回到首页
 */
export function createScopePage({ bank, initialVolumes, initialLimit, onStart, onBack }) {
  const volumes = Array.isArray(bank.volumes) ? bank.volumes : [];
  const known = volumes.map((v) => v.id);

  /* 只在已知卷里选；没传就默认全选，避免"进来一片空白" */
  let selected = normalizeVolumeIds(initialVolumes).filter((id) => known.includes(id));
  if (!selected.length) selected = known.slice();

  let limit = Number.isFinite(initialLimit) ? initialLimit : 20;

  function countOf(vol) {
    const qs = (bank.volumeQuestions && bank.volumeQuestions[vol.id]) || [];
    return qs.length || vol.count || 0;
  }

  function selectedCount() {
    return selected.reduce((sum, id) => {
      const v = volumes.find((x) => x.id === id);
      return sum + (v ? countOf(v) : 0);
    }, 0);
  }

  function volRows() {
    return volumes
      .map((v) => {
        const on = selected.includes(v.id);
        const n = countOf(v);
        const pending = v.pending || 0;
        const years =
          v.yearFrom && v.yearTo ? `${esc(v.yearFrom)} — ${esc(v.yearTo)}` : "";
        return `
        <button type="button" class="vol-row${on ? " vol-row-on" : ""}"
                data-action="toggle" data-value="${esc(v.id)}"
                role="checkbox" aria-checked="${on ? "true" : "false"}">
          <span class="vol-check" aria-hidden="true">${on ? "✓" : ""}</span>
          <span class="vol-main">
            <span class="vol-name">${esc(v.name || v.id)}</span>
            <span class="vol-meta">${years}${years ? " · " : ""}${n} 题${
          pending ? ` · 待核对 ${pending}` : ""
        }</span>
          </span>
        </button>`;
      })
      .join("");
  }

  function limitSegs() {
    return LIMITS.map((l) => {
      const on = limit === l.value ? " seg-on" : "";
      return `<button type="button" class="seg${on}" data-action="limit" data-value="${l.value}">${esc(
        l.label
      )}</button>`;
    }).join("");
  }

  function render() {
    const total = selectedCount();
    const picked = selected.length;
    const canStart = picked > 0 && total > 0;
    const applied = limit > 0 ? Math.min(limit, total) : total;

    return `
      <main class="page page-scope">
        <header class="head scope-head">
          <button type="button" class="link-btn scope-back" data-action="back">← 返回</button>
          <h1 class="title">自定义范围</h1>
          <p class="subtitle">勾选要刷的卷次，可跨卷混合随机</p>
        </header>

        <div class="scope-bar">
          <span class="scope-sum">
            已选 <b>${picked}</b> 卷 · <b>${total}</b> 题${
      limit > 0 && total > limit ? `（本轮取 ${applied} 题）` : ""
    }
          </span>
          <span class="scope-actions">
            <button type="button" class="link-btn" data-action="all">全选</button>
            <button type="button" class="link-btn" data-action="none">清空</button>
          </span>
        </div>

        <ul class="vol-list">${volRows()}</ul>

        <section class="section">
          <h2 class="section-title">本轮题量</h2>
          <div class="seg-group">${limitSegs()}</div>
        </section>

        <button type="button" class="btn btn-primary btn-block" data-action="start"${
          canStart ? "" : " disabled"
        }>
          ${canStart ? `开始答题（${applied} 题）` : "请至少选择一卷"}
        </button>

        <button type="button" class="btn btn-ghost btn-block" data-action="back">返回首页</button>

        <p class="muted foot-note">题目会从所选卷次中打乱抽取，跨卷混合。</p>
      </main>`;
  }

  function handle(action, value) {
    if (action === "toggle") {
      const i = selected.indexOf(value);
      if (i >= 0) selected = selected.filter((x) => x !== value);
      else selected = selected.concat([value]);
      return "rerender";
    }
    if (action === "all") {
      selected = known.slice();
      return "rerender";
    }
    if (action === "none") {
      selected = [];
      return "rerender";
    }
    if (action === "limit") {
      limit = Number(value) || 0;
      return "rerender";
    }
    if (action === "start") {
      if (!selected.length) return undefined;
      onStart({ volumeIds: selected.slice(), limit });
      return undefined;
    }
    if (action === "back") {
      onBack();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
