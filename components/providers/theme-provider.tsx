"use client";

import * as React from "react";

import { usePrefs } from "./prefs-provider";

/**
 * 主题落地：把 themeMode 翻译成 <html> 上的 .dark（PRD FT-SET-003）。
 * 首帧前由 layout 里的内联脚本抢先设置，避免深色下闪白。
 */
export function ThemeApplier() {
  const { themeMode, hydrated } = usePrefs();

  React.useEffect(() => {
    if (!hydrated) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = themeMode === "dark" || (themeMode === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    if (themeMode !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themeMode, hydrated]);

  return null;
}

/** 语言变化时同步 <html lang>，方便屏幕阅读器与浏览器断词。 */
export function LangApplier() {
  const { locale, hydrated } = usePrefs();
  React.useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale, hydrated]);
  return null;
}

/** 在 React 接手前同步应用主题，消除首帧闪烁。 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('fastype:prefs');
    var mode = raw ? (JSON.parse(raw).data || {}).themeMode : 'system';
    if (mode !== 'light' && mode !== 'dark') mode = 'system';
    var dark = mode === 'dark' || (mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`.trim();
