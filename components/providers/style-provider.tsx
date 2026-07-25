"use client";

import * as React from "react";

import { StorageKey } from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";
import {
  CUSTOM_THEME_DRAFT_ID,
  createSavedCustomTheme,
  emptyCustomThemeLibrary,
  normalizeCustomThemeName,
  parseCustomThemeLibrary,
  type CustomThemeLibrary,
  type SavedCustomTheme,
} from "@/lib/themes/custom";
import {
  DEFAULT_WECHAT_STYLE,
  parseWechatStyle,
  wechatStyleFromTheme,
  type WechatStyle,
} from "@/lib/themes/wechat";
import { DEFAULT_WECHAT_COVER, parseWechatCover, type WechatCover } from "@/lib/wechat-cover";
import {
  DEFAULT_XHS_STYLE,
  parseXhsStyle,
  xhsStyleFromTheme,
  type XhsStyle,
} from "@/lib/themes/xhs";

const xhsStore = createLocalStore(StorageKey.xhsStyle, parseXhsStyle, DEFAULT_XHS_STYLE);
const wechatStore = createLocalStore(
  StorageKey.wechatStyle,
  parseWechatStyle,
  DEFAULT_WECHAT_STYLE,
);
const wechatCoverStore = createLocalStore(
  StorageKey.wechatCover,
  parseWechatCover,
  DEFAULT_WECHAT_COVER,
);
const EMPTY_XHS_THEMES = emptyCustomThemeLibrary<XhsStyle>();
const EMPTY_WECHAT_THEMES = emptyCustomThemeLibrary<WechatStyle>();
const xhsThemeStore = createLocalStore(
  StorageKey.xhsThemes,
  (raw) => parseCustomThemeLibrary(raw, parseXhsStyle),
  EMPTY_XHS_THEMES,
);
const wechatThemeStore = createLocalStore(
  StorageKey.wechatThemes,
  (raw) => parseCustomThemeLibrary(raw, parseWechatStyle),
  EMPTY_WECHAT_THEMES,
);

/**
 * 缓存 JSON.stringify 结果，避免每次渲染都对大对象做全量序列化。
 * 只有引用变化时才重新计算。
 */
function useStableStringify(value: unknown): string {
  return React.useMemo(() => JSON.stringify(value), [value]);
}

interface StyleContextValue {
  xhs: XhsStyle;
  wechat: WechatStyle;
  wechatCover: WechatCover;
  xhsCustomThemes: SavedCustomTheme<XhsStyle>[];
  wechatCustomThemes: SavedCustomTheme<WechatStyle>[];
  selectedXhsThemeId: string;
  selectedWechatThemeId: string;
  isSelectedXhsThemeDirty: boolean;
  isSelectedWechatThemeDirty: boolean;
  setXhs: (patch: Partial<XhsStyle>) => void;
  setWechat: (patch: Partial<WechatStyle>) => void;
  setWechatCover: (patch: Partial<WechatCover>) => void;
  /** 切换主题会整体套用该主题默认值。 */
  setXhsTheme: (themeId: string) => void;
  setWechatTheme: (themeId: string) => void;
  createXhsThemeDraft: () => void;
  createWechatThemeDraft: () => void;
  applyXhsCustomTheme: (themeId: string) => void;
  applyWechatCustomTheme: (themeId: string) => void;
  saveXhsCustomTheme: (name: string) => void;
  saveWechatCustomTheme: (name: string) => void;
  updateXhsCustomTheme: (name: string) => void;
  updateWechatCustomTheme: (name: string) => void;
  copyXhsTheme: (themeId: string, name: string) => void;
  copyWechatTheme: (themeId: string, name: string) => void;
  deleteXhsCustomTheme: (themeId: string) => void;
  deleteWechatCustomTheme: (themeId: string) => void;
  /** 恢复当前主题默认值（PRD FT-XHS-003 / FT-WX-002）。 */
  resetXhs: () => void;
  resetWechat: () => void;
  resetWechatCover: () => void;
  clearStyles: () => void;
}

const StyleContext = React.createContext<StyleContextValue | null>(null);

export function StyleProvider({ children }: { children: React.ReactNode }) {
  const xhs = React.useSyncExternalStore(
    xhsStore.subscribe,
    xhsStore.getSnapshot,
    xhsStore.getServerSnapshot,
  );
  const wechat = React.useSyncExternalStore(
    wechatStore.subscribe,
    wechatStore.getSnapshot,
    wechatStore.getServerSnapshot,
  );
  const wechatCover = React.useSyncExternalStore(
    wechatCoverStore.subscribe,
    wechatCoverStore.getSnapshot,
    wechatCoverStore.getServerSnapshot,
  );
  const xhsThemeLibrary = React.useSyncExternalStore(
    xhsThemeStore.subscribe,
    xhsThemeStore.getSnapshot,
    xhsThemeStore.getServerSnapshot,
  );
  const wechatThemeLibrary = React.useSyncExternalStore(
    wechatThemeStore.subscribe,
    wechatThemeStore.getSnapshot,
    wechatThemeStore.getServerSnapshot,
  );

  const selectedXhsTheme = xhsThemeLibrary.themes.find(
    (theme) => theme.id === xhsThemeLibrary.selectedId,
  );
  const selectedWechatTheme = wechatThemeLibrary.themes.find(
    (theme) => theme.id === wechatThemeLibrary.selectedId,
  );

  // 缓存序列化结果，只在引用变化时重新计算，避免每次渲染都做全量 JSON.stringify。
  const xhsJson = useStableStringify(xhs);
  const wechatJson = useStableStringify(wechat);
  const selectedXhsThemeJson = useStableStringify(selectedXhsTheme?.style ?? null);
  const selectedWechatThemeJson = useStableStringify(selectedWechatTheme?.style ?? null);

  const setXhsLibrary = React.useCallback(
    (patch: Partial<CustomThemeLibrary<XhsStyle>>) =>
      xhsThemeStore.set({ ...xhsThemeLibrary, ...patch }),
    [xhsThemeLibrary],
  );
  const setWechatLibrary = React.useCallback(
    (patch: Partial<CustomThemeLibrary<WechatStyle>>) =>
      wechatThemeStore.set({ ...wechatThemeLibrary, ...patch }),
    [wechatThemeLibrary],
  );

  const value = React.useMemo<StyleContextValue>(
    () => ({
      xhs,
      wechat,
      wechatCover,
      xhsCustomThemes: xhsThemeLibrary.themes,
      wechatCustomThemes: wechatThemeLibrary.themes,
      selectedXhsThemeId: xhsThemeLibrary.selectedId ?? xhs.themeId,
      selectedWechatThemeId: wechatThemeLibrary.selectedId ?? wechat.themeId,
      isSelectedXhsThemeDirty: Boolean(selectedXhsTheme && selectedXhsThemeJson !== xhsJson),
      isSelectedWechatThemeDirty: Boolean(
        selectedWechatTheme && selectedWechatThemeJson !== wechatJson,
      ),
      setXhs: (patch) => xhsStore.set({ ...xhs, ...patch }),
      setWechat: (patch) => wechatStore.set({ ...wechat, ...patch }),
      setWechatCover: (patch) => wechatCoverStore.set({ ...wechatCover, ...patch }),
      setXhsTheme: (themeId) => {
        setXhsLibrary({ selectedId: null });
        const next = xhsStyleFromTheme(themeId, xhs.exportSizeId);
        xhsStore.set({
          ...next,
          aspectRatio: xhs.aspectRatio,
          customWidth: xhs.customWidth,
          customHeight: xhs.customHeight,
          headingTemplate: xhs.headingTemplate,
          headings: xhs.headings,
          cover: xhs.cover,
          identifier: xhs.identifier,
          qrCode: xhs.qrCode,
          showPageNumber: xhs.showPageNumber,
          showPageNumberOnCover: xhs.showPageNumberOnCover,
          pageNumberAlign: xhs.pageNumberAlign,
          pageNumberScale: xhs.pageNumberScale,
          pageNumberGap: xhs.pageNumberGap,
        });
      },
      setWechatTheme: (themeId) => {
        setWechatLibrary({ selectedId: null });
        wechatStore.set(wechatStyleFromTheme(themeId));
      },
      createXhsThemeDraft: () => setXhsLibrary({ selectedId: CUSTOM_THEME_DRAFT_ID }),
      createWechatThemeDraft: () => setWechatLibrary({ selectedId: CUSTOM_THEME_DRAFT_ID }),
      applyXhsCustomTheme: (themeId) => {
        const saved = xhsThemeLibrary.themes.find((theme) => theme.id === themeId);
        if (!saved) return;
        xhsStore.set(saved.style);
        setXhsLibrary({ selectedId: saved.id });
      },
      applyWechatCustomTheme: (themeId) => {
        const saved = wechatThemeLibrary.themes.find((theme) => theme.id === themeId);
        if (!saved) return;
        wechatStore.set(saved.style);
        setWechatLibrary({ selectedId: saved.id });
      },
      saveXhsCustomTheme: (name) => {
        if (!normalizeCustomThemeName(name)) return;
        const saved = createSavedCustomTheme(name, xhs);
        xhsThemeStore.set({
          selectedId: saved.id,
          themes: [...xhsThemeLibrary.themes, saved],
        });
      },
      saveWechatCustomTheme: (name) => {
        if (!normalizeCustomThemeName(name)) return;
        const saved = createSavedCustomTheme(name, wechat);
        wechatThemeStore.set({
          selectedId: saved.id,
          themes: [...wechatThemeLibrary.themes, saved],
        });
      },
      updateXhsCustomTheme: (name) => {
        if (!selectedXhsTheme || !normalizeCustomThemeName(name)) return;
        xhsThemeStore.set({
          selectedId: selectedXhsTheme.id,
          themes: xhsThemeLibrary.themes.map((theme) =>
            theme.id === selectedXhsTheme.id
              ? { ...theme, name: normalizeCustomThemeName(name), style: xhs }
              : theme,
          ),
        });
      },
      updateWechatCustomTheme: (name) => {
        if (!selectedWechatTheme || !normalizeCustomThemeName(name)) return;
        wechatThemeStore.set({
          selectedId: selectedWechatTheme.id,
          themes: wechatThemeLibrary.themes.map((theme) =>
            theme.id === selectedWechatTheme.id
              ? { ...theme, name: normalizeCustomThemeName(name), style: wechat }
              : theme,
          ),
        });
      },
      copyXhsTheme: (themeId, name) => {
        const source =
          xhsThemeLibrary.themes.find((theme) => theme.id === themeId)?.style ??
          xhsStyleFromTheme(themeId, xhs.exportSizeId);
        const saved = createSavedCustomTheme(name, source);
        xhsStore.set(source);
        xhsThemeStore.set({ selectedId: saved.id, themes: [...xhsThemeLibrary.themes, saved] });
      },
      copyWechatTheme: (themeId, name) => {
        const source =
          wechatThemeLibrary.themes.find((theme) => theme.id === themeId)?.style ??
          wechatStyleFromTheme(themeId);
        const saved = createSavedCustomTheme(name, source);
        wechatStore.set(source);
        wechatThemeStore.set({
          selectedId: saved.id,
          themes: [...wechatThemeLibrary.themes, saved],
        });
      },
      deleteXhsCustomTheme: (themeId) => {
        setXhsLibrary({
          selectedId: xhsThemeLibrary.selectedId === themeId ? null : xhsThemeLibrary.selectedId,
          themes: xhsThemeLibrary.themes.filter((theme) => theme.id !== themeId),
        });
      },
      deleteWechatCustomTheme: (themeId) => {
        setWechatLibrary({
          selectedId:
            wechatThemeLibrary.selectedId === themeId ? null : wechatThemeLibrary.selectedId,
          themes: wechatThemeLibrary.themes.filter((theme) => theme.id !== themeId),
        });
      },
      resetXhs: () => {
        if (selectedXhsTheme) {
          xhsStore.set(selectedXhsTheme.style);
          return;
        }
        const next = xhsStyleFromTheme(xhs.themeId, xhs.exportSizeId);
        xhsStore.set({
          ...next,
          aspectRatio: xhs.aspectRatio,
          customWidth: xhs.customWidth,
          customHeight: xhs.customHeight,
          cover: {
            ...next.cover,
            enabled: xhs.cover.enabled,
            text: xhs.cover.text,
            graphics: xhs.cover.graphics,
          },
          identifier: xhs.identifier,
          qrCode: xhs.qrCode,
          showPageNumber: xhs.showPageNumber,
          showPageNumberOnCover: xhs.showPageNumberOnCover,
          pageNumberAlign: xhs.pageNumberAlign,
          pageNumberScale: xhs.pageNumberScale,
          pageNumberGap: xhs.pageNumberGap,
        });
      },
      resetWechat: () =>
        wechatStore.set(selectedWechatTheme?.style ?? wechatStyleFromTheme(wechat.themeId)),
      resetWechatCover: () => wechatCoverStore.reset(),
      clearStyles: () => {
        xhsStore.reset();
        wechatStore.reset();
        wechatCoverStore.reset();
        xhsThemeStore.reset();
        wechatThemeStore.reset();
      },
    }),
    [
      xhs,
      wechat,
      wechatCover,
      xhsThemeLibrary,
      wechatThemeLibrary,
      selectedXhsTheme,
      selectedWechatTheme,
      setXhsLibrary,
      setWechatLibrary,
      xhsJson,
      wechatJson,
      selectedXhsThemeJson,
      selectedWechatThemeJson,
    ],
  );

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}

export function useStyles(): StyleContextValue {
  const context = React.useContext(StyleContext);
  if (!context) throw new Error("useStyles must be used inside <StyleProvider>");
  return context;
}
