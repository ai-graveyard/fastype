export const MARKDOWN_PREVIEW_THEMES = ["github", "notion", "paper", "night"] as const;

export type MarkdownPreviewTheme = (typeof MARKDOWN_PREVIEW_THEMES)[number];

export const DEFAULT_MARKDOWN_PREVIEW_THEME: MarkdownPreviewTheme = "github";

export function isMarkdownPreviewTheme(value: unknown): value is MarkdownPreviewTheme {
  return (
    typeof value === "string" && (MARKDOWN_PREVIEW_THEMES as readonly string[]).includes(value)
  );
}
