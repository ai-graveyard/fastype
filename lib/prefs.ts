import { isLocale, type Locale } from "@/lib/i18n";
import {
  DEFAULT_MARKDOWN_PREVIEW_THEME,
  isMarkdownPreviewTheme,
  type MarkdownPreviewTheme,
} from "@/lib/themes/markdown";
import {
  DEFAULT_RATIOS,
  isThemeMode,
  isViewId,
  VIEWS,
  type ThemeMode,
  type ViewId,
} from "@/lib/types";

/** 语言、主题、上次视图和三个视图各自的分栏比例（PRD FT-SET-001 / FT-LYT-003）。 */
export interface Prefs {
  locale: Locale;
  themeMode: ThemeMode;
  markdownPreviewTheme: MarkdownPreviewTheme;
  lastView: ViewId;
  ratios: Record<ViewId, number>;
}

export const DEFAULT_PREFS: Prefs = {
  locale: "zh",
  themeMode: "system",
  markdownPreviewTheme: DEFAULT_MARKDOWN_PREVIEW_THEME,
  lastView: "xhs",
  ratios: { ...DEFAULT_RATIOS },
};

/** 比例限制在合理区间，避免坏数据把某一栏挤没（PRD FT-LYT-002）。 */
export const MIN_RATIO = 0.15;
export const MAX_RATIO = 0.85;

function ratio(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < MIN_RATIO || value > MAX_RATIO) return fallback;
  return value;
}

export function parsePrefs(raw: unknown): Prefs | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<Prefs>;
  const ratios = (input.ratios ?? {}) as Partial<Record<ViewId, number>>;
  return {
    locale: isLocale(input.locale) ? input.locale : DEFAULT_PREFS.locale,
    themeMode: isThemeMode(input.themeMode) ? input.themeMode : DEFAULT_PREFS.themeMode,
    markdownPreviewTheme: isMarkdownPreviewTheme(input.markdownPreviewTheme)
      ? input.markdownPreviewTheme
      : DEFAULT_PREFS.markdownPreviewTheme,
    lastView: isViewId(input.lastView) ? input.lastView : DEFAULT_PREFS.lastView,
    ratios: Object.fromEntries(
      VIEWS.map((view) => [view, ratio(ratios[view], DEFAULT_RATIOS[view])]),
    ) as Record<ViewId, number>,
  };
}

/** 草稿与设置分开存储，清样式不会误删正文（PRD FT-SET-001）。 */
export interface Draft {
  filename: string;
  content: string;
  /** 最后一次写入本地草稿的时间戳。 */
  savedAt: number;
}

export const DEFAULT_DRAFT: Draft = { filename: "", content: "", savedAt: 0 };

export function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<Draft>;
  if (typeof input.content !== "string") return null;
  return {
    filename: typeof input.filename === "string" ? input.filename : "",
    content: input.content,
    savedAt: typeof input.savedAt === "number" ? input.savedAt : 0,
  };
}
