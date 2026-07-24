"use client";

import * as React from "react";

import {
  detectLocale,
  translate,
  type Locale,
  type TKey,
  type TParams,
} from "@/lib/i18n";
import { DEFAULT_PREFS, parsePrefs, type Prefs } from "@/lib/prefs";
import { StorageKey } from "@/lib/storage";
import { clientOnlyStore, createLocalStore } from "@/lib/storage/store";
import type { MarkdownPreviewTheme } from "@/lib/themes/markdown";
import { DEFAULT_RATIOS, type ThemeMode, type ViewId } from "@/lib/types";

/** 首次访问优先跟随浏览器语言，不匹配时默认中文（PRD FT-SET-004）。 */
const prefsStore = createLocalStore(
  StorageKey.prefs,
  parsePrefs,
  DEFAULT_PREFS,
  (fallback) => ({
    ...fallback,
    locale:
      typeof navigator === "undefined"
        ? fallback.locale
        : detectLocale(navigator.languages ?? [navigator.language]),
  }),
);

interface PrefsContextValue extends Prefs {
  t: (key: TKey, params?: TParams) => string;
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setMarkdownPreviewTheme: (theme: MarkdownPreviewTheme) => void;
  setLastView: (view: ViewId) => void;
  setRatio: (view: ViewId, ratio: number) => void;
  resetPrefs: () => void;
  /** 已经在客户端跑起来了；依赖 DOM 的渲染要等它为 true。 */
  hydrated: boolean;
}

const PrefsContext = React.createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const prefs = React.useSyncExternalStore(
    prefsStore.subscribe,
    prefsStore.getSnapshot,
    prefsStore.getServerSnapshot,
  );
  const hydrated = React.useSyncExternalStore(
    clientOnlyStore.subscribe,
    clientOnlyStore.getSnapshot,
    clientOnlyStore.getServerSnapshot,
  );

  const value = React.useMemo<PrefsContextValue>(
    () => ({
      ...prefs,
      hydrated,
      t: (key, params) => translate(prefs.locale, key, params),
      setLocale: (locale) => prefsStore.set({ ...prefs, locale }),
      setThemeMode: (themeMode) => prefsStore.set({ ...prefs, themeMode }),
      setMarkdownPreviewTheme: (markdownPreviewTheme) =>
        prefsStore.set({ ...prefs, markdownPreviewTheme }),
      setLastView: (lastView) => prefsStore.set({ ...prefs, lastView }),
      setRatio: (view, ratio) =>
        prefsStore.set({ ...prefs, ratios: { ...prefs.ratios, [view]: ratio } }),
      resetPrefs: () => prefsStore.set({ ...DEFAULT_PREFS, ratios: { ...DEFAULT_RATIOS } }),
    }),
    [prefs, hydrated],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const context = React.useContext(PrefsContext);
  if (!context) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return context;
}

/** 只要文案的场景用这个，少解构一层。 */
export function useT() {
  return usePrefs().t;
}
