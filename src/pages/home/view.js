/**
 * 首页（S1）—— 今日进度、继续上次、选择模式
 *
 * 状态全部在本模块的闭包里，不写进 DOM（V2）。
 * 数据由 main.js 注入（summary），本页不读存储。
 */

import { esc, pctText, pct } from "../../ui/dom.js";
import { MODE } from "../../core/session.js";

const MODE_LABEL = {
  sequence: "顺序刷",
  random: "随机刷",
  byTag: "按事件刷",
  wrongOnly: "只刷错题",
  custom: "自定义范围",
};

const MODES = [
  { key: MODE.SEQUENCE, label: "顺序刷", desc: "按题库顺序，适合系统过一遍" },
  { key: MODE.RANDOM, label: "随机刷", desc: "打乱顺序，防止靠位置记忆" },
  { key: MODE.BY_TAG, label: "按事件刷", desc: "先选卷，再选事件" },
  { key: MODE.WRONG_ONLY, label: "只刷错题", desc: "错题本中的题" },
  { key: MODE.CUSTOM, label: "自定义范围", desc: "自由勾选卷次，跨卷混合" },
];

const LIMITS = [
  { value: 0, label: "全部" },
  { value: 10, label: "10 题" },
  { value: 15, label: "15 题" },
];

export function createHomePage({
  bank,
  onStart,
  onResume,
  onDiscard,
  onSettings,
  onScope,
  summary = {},
}) {
  const volumes = Array.isArray(bank.volumes) ? bank.volumes : [];
  const volumeEvents = bank.volumeEvents || {};
  const multiVolume = volumes.length > 1;

  /* 「按事件刷」的两级筛选：先选卷，null 表示全部卷 */
  let tagVolume = null;

  function eventsOf(volId) {
    if (volId && volumeEvents[volId]) return volumeEvents[volId];
    const out = [];
    for (const v of volumes) {
      for (const ev of volumeEvents[v.id] || []) {
        if (!out.includes(ev)) out.push(ev);
      }
    }
    return out;
  }

  const allEvents = eventsOf(null);
  /* 事件题数优先用索引里的统计（M6-D：首页不下载任何卷）；
     老索引没有这个字段时，退回按已加载的题目现算。 */
  const indexCounts =
    bank.eventCounts && Object.keys(bank.eventCounts).length ? bank.eventCounts : null;
  const counts = indexCounts ? { ...indexCounts } : {};
  if (!indexCounts) {
    for (const q of bank.questions) {
      const ev = q.source && q.source.event;
      if (ev) counts[ev] = (counts[ev] || 0) + 1;
    }
  }

  const wrongCount = summary.wrongCount || 0;
  const resume = summary.resume || null;
  const today = summary.today || { count: 0, goal: 10 };

  let mode = MODE.SEQUENCE;
  let tag = allEvents[0] || null;
  let limit = 0;

  function modeCards() {
    return MODES.map((m) => {
      const isWrong = m.key === MODE.WRONG_ONLY;
      const off = isWrong && wrongCount === 0;
      const desc = isWrong
        ? wrongCount > 0
          ? `错题本中 ${wrongCount} 题`
          : "错题本为空，先去刷题"
        : m.desc;
      const active = mode === m.key ? " mode-card-on" : "";
      return `
        <button type="button" class="mode-card${active}"
                data-action="mode" data-value="${esc(m.key)}"${off ? " disabled" : ""}>
          <span class="mode-label">${esc(m.label)}</span>
          <span class="mode-desc">${esc(desc)}</span>
        </button>`;
    }).join("");
  }

  function volChips() {
    if (!multiVolume) return "";
    const items = [{ id: null, name: "全部卷" }].concat(volumes.map((v) => ({ id: v.id, name: v.name })));
    return items
      .map((v) => {
        const on = tagVolume === v.id ? " chip-btn-on" : "";
        return `<button type="button" class="chip-btn${on}" data-action="tagvol" data-value="${esc(
          v.id || ""
        )}">${esc(v.name)}</button>`;
      })
      .join("");
  }

  function tagPicker() {
    if (mode !== MODE.BY_TAG) return "";
    const list = eventsOf(tagVolume);
    const chips = list
      .map((ev) => {
        const on = tag === ev ? " chip-btn-on" : "";
        return `<button type="button" class="chip-btn${on}" data-action="tag" data-value="${esc(ev)}">
            ${esc(ev)}<span class="chip-count">${counts[ev] || 0}</span>
          </button>`;
      })
      .join("");

    const volSection = multiVolume
      ? `<h2 class="section-title">先选卷</h2>
         <div class="chips-wrap section-tight">${volChips()}</div>`
      : "";

    return `
      <section class="section">
        ${volSection}
        <h2 class="section-title">选择事件</h2>
        <div class="chips-wrap">${chips || '<span class="muted">该卷暂无事件标签</span>'}</div>
      </section>`;
  }

  function limitPicker() {
    const items = LIMITS.map((l) => {
      const on = limit === l.value ? " seg-on" : "";
      return `<button type="button" class="seg${on}" data-action="limit" data-value="${l.value}">${esc(l.label)}</button>`;
    }).join("");
    return `
      <section class="section">
        <h2 class="section-title">本轮题量</h2>
        <div class="seg-group">${items}</div>
      </section>`;
  }

  function todayCard() {
    const goal = today.goal || 10;
    const count = today.count || 0;
    const width = pct(goal ? Math.min(1, count / goal) : 0) || 0;
    const done = count >= goal;
    return `
      <div class="today-card">
        <div class="today-row">
          <span class="today-label">今日</span>
          <span class="today-value">${count} / ${goal}</span>
        </div>
        <div class="today-bar"><span class="today-fill${done ? " today-fill-done" : ""}" style="width: ${width}%"></span></div>
        <p class="today-note">${done ? "今日目标已完成，可以继续加练。" : `还差 ${goal - count} 题达成今日目标。`}</p>
      </div>`;
  }

  function resumeCard() {
    if (!resume) return "";
    return `
      <div class="resume-card">
        <div class="resume-main">
          <span class="resume-title">继续上次</span>
          <span class="resume-meta">
            已完成 ${resume.answered} / ${resume.total} · ${esc(MODE_LABEL[resume.mode] || resume.mode)}
          </span>
        </div>
        <div class="resume-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="resume">继续</button>
          <button type="button" class="link-btn" data-action="discard">放弃</button>
        </div>
      </div>`;
  }

  function render() {
    const totals = bank.meta.totals || {
      volumes: 1,
      questions: bank.questions.length,
      pending: 0,
    };
    const total = totals.questions;
    const pending = totals.pending;

    return `
      <main class="page page-home">
        <header class="head">
          <h1 class="title">${esc(bank.meta.title || "题库")}</h1>
          <p class="subtitle">共 ${totals.volumes} 卷 · ${total} 题</p>
          ${
            summary.totalAnswered
              ? `<p class="subtitle">累计已答 ${summary.totalAnswered} 题 · 正确率 ${pctText(
                  summary.accuracy
                )} · 错题 ${wrongCount} 题</p>`
              : ""
          }
        </header>

        ${todayCard()}

        ${summary.storageNote ? `<div class="notice notice-warn">${esc(summary.storageNote)}</div>` : ""}
        ${
          summary.offlineCapable === false
            ? `<div class="notice notice-warn">当前是局域网访问，浏览器不支持离线缓存：电脑上的服务必须开着才能用，关掉就打不开了。（本机用 127.0.0.1 访问不受此限制。）</div>`
            : ""
        }
        ${resumeCard()}
        ${pending ? `<div class="notice">本库 ${pending} 题原文待核对，答题后解析面板会逐题提示。</div>` : ""}

        <section class="section">
          <h2 class="section-title">刷题方式</h2>
          <div class="mode-grid">${modeCards()}</div>
        </section>

        ${tagPicker()}
        ${limitPicker()}

        <button type="button" class="btn ${resume ? "btn-ghost" : "btn-primary"} btn-block" data-action="start">
          ${resume ? "开始新一轮（放弃上次）" : "开始答题"}
        </button>

        <button type="button" class="btn btn-ghost btn-block btn-settings" data-action="settings">
          设置与数据
        </button>

        <p class="muted foot-note">统计、错题本与未完成的那一轮都会自动保存到本机浏览器。</p>
      </main>`;
  }

  function handle(action, value) {
    if (action === "mode") {
      /* 自定义范围不是「就地开始」，而是先跳到范围选择页 */
      if (value === MODE.CUSTOM) {
        if (onScope) onScope();
        return undefined;
      }
      mode = value;
      if (mode === MODE.BY_TAG) tag = eventsOf(tagVolume)[0] || null;
      return "rerender";
    }
    if (action === "tagvol") {
      tagVolume = value || null;
      const list = eventsOf(tagVolume);
      if (!list.includes(tag)) tag = list[0] || null;
      return "rerender";
    }
    if (action === "tag") {
      tag = value;
      return "rerender";
    }
    if (action === "limit") {
      limit = Number(value) || 0;
      return "rerender";
    }
    if (action === "start") {
      onStart({
        mode,
        tag: mode === MODE.BY_TAG ? tag : null,
        limit,
        volumeIds: mode === MODE.BY_TAG && tagVolume ? [tagVolume] : [],
      });
      return undefined;
    }
    if (action === "resume") {
      onResume();
      return undefined;
    }
    if (action === "discard") {
      if (window.confirm("放弃上次未完成的那一轮？已答的记录仍保留在统计里。")) {
        onDiscard();
        return "rerender";
      }
      return undefined;
    }
    if (action === "settings") {
      onSettings();
      return undefined;
    }
    return undefined;
  }

  return { render, handle };
}
