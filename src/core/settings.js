/**
 * settings.js —— 设置项（M4）
 *
 * D1：零 DOM / 零存储。normalizeSettings 负责把任意输入收敛成合法值，
 *     避免手改 localStorage 或旧版本数据导致界面异常。
 */

export const THEMES = ["auto", "light", "dark"];
export const DAILY_GOALS = [5, 10, 15, 20];

export const DEFAULT_SETTINGS = {
  dailyGoal: 10,
  theme: "auto",
  /* 自定义范围页上次的选择（M6-B）：卷次与题量，让下次进来不用重新勾 */
  lastScopeVolumes: [],
  lastScopeLimit: 20,
};

export function normalizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};

  const goal = Number(src.dailyGoal);
  const dailyGoal = DAILY_GOALS.includes(goal) ? goal : DEFAULT_SETTINGS.dailyGoal;

  const theme = THEMES.includes(src.theme) ? src.theme : DEFAULT_SETTINGS.theme;

  const vols = Array.isArray(src.lastScopeVolumes)
    ? src.lastScopeVolumes.filter((v) => typeof v === "string" && v)
    : [];

  const lim = Number(src.lastScopeLimit);
  const lastScopeLimit = Number.isFinite(lim) && lim >= 0 ? lim : DEFAULT_SETTINGS.lastScopeLimit;

  return { dailyGoal, theme, lastScopeVolumes: vols, lastScopeLimit };
}

export const THEME_LABEL = {
  auto: "跟随系统",
  light: "浅色",
  dark: "深色",
};
