export const VIEWS = ["xhs", "wechat", "markdown"] as const;
export type ViewId = (typeof VIEWS)[number];

/** 小红书和公众号“内容”编辑器的显示方式。 */
export const PLATFORM_EDITOR_MODES = ["text", "preview"] as const;
export type PlatformEditorMode = (typeof PLATFORM_EDITOR_MODES)[number];

export function isViewId(value: unknown): value is ViewId {
  return typeof value === "string" && (VIEWS as readonly string[]).includes(value);
}

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

/** 三个视图各自记住自己的分栏比例（PRD FT-LYT-003）。 */
export const DEFAULT_RATIOS: Record<ViewId, number> = {
  markdown: 0.5,
  xhs: 1 / 3,
  wechat: 1 / 3,
};

/** 分栏最小宽度（PRD FT-LYT-002）。 */
export const MIN_PREVIEW_WIDTH = 280;
export const MIN_EDITOR_WIDTH = 360;
/** 低于这个宽度就没法同时放下两栏，进入窄屏降级。 */
export const NARROW_BREAKPOINT = MIN_PREVIEW_WIDTH + MIN_EDITOR_WIDTH + 8;
