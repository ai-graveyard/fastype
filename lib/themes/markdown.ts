import type { TKey } from "@/lib/i18n";

/** 工具栏上直接铺开的常用主题，其余主题收进「更多」下拉。 */
// 三个快捷位刻意拉开差异：亮色标准、暖色纸张、深色；Notion 和 GitHub 太像，放进「更多」。
export const MARKDOWN_PREVIEW_QUICK_THEMES = ["github", "paper", "night"] as const;

export const MARKDOWN_PREVIEW_MORE_THEMES = [
  "notion",
  "ink",
  "sakura",
  "mint",
  "terminal",
] as const;

export const MARKDOWN_PREVIEW_THEMES = [
  ...MARKDOWN_PREVIEW_QUICK_THEMES,
  ...MARKDOWN_PREVIEW_MORE_THEMES,
] as const;

export type MarkdownPreviewTheme = (typeof MARKDOWN_PREVIEW_THEMES)[number];

export const DEFAULT_MARKDOWN_PREVIEW_THEME: MarkdownPreviewTheme = "github";

export const MARKDOWN_PREVIEW_THEME_LABEL_KEYS: Record<MarkdownPreviewTheme, TKey> = {
  github: "editor.themeGitHub",
  notion: "editor.themeNotion",
  paper: "editor.themePaper",
  night: "editor.themeNight",
  ink: "editor.themeInk",
  sakura: "editor.themeSakura",
  mint: "editor.themeMint",
  terminal: "editor.themeTerminal",
};

export function isMarkdownPreviewTheme(value: unknown): value is MarkdownPreviewTheme {
  return (
    typeof value === "string" && (MARKDOWN_PREVIEW_THEMES as readonly string[]).includes(value)
  );
}
