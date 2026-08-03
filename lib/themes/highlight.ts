import { HIGHLIGHT_TOKENS, highlightClass, type HighlightToken } from "@/lib/markdown/highlight";

/**
 * 代码高亮配色。
 *
 * 三个视图共用这一份：编辑器预览和小红书卡片走 CSS 规则，公众号走内联样式
 * （lib/render/wechat.ts 会把 class 全剥掉），所以这里同时提供两种取法。
 *
 * 深浅两套按代码块的背景色选，而不是按界面主题——小红书卡片的代码块背景是用户自己
 * 调的，界面是浅色不代表那块底也是浅色。
 */

export type HighlightPalette = Record<HighlightToken, string>;

/** 浅底配色，取自 GitHub Light 的常用几档。 */
const LIGHT: HighlightPalette = {
  keyword: "#cf222e",
  string: "#0a3069",
  comment: "#6e7781",
  number: "#0550ae",
  function: "#8250df",
  type: "#953800",
  variable: "#24292f",
  punctuation: "#57606a",
};

/** 深底配色，取自 One Dark 的常用几档。 */
const DARK: HighlightPalette = {
  keyword: "#c678dd",
  string: "#98c379",
  comment: "#7f848e",
  number: "#d19a66",
  function: "#61afef",
  type: "#e5c07b",
  variable: "#e06c75",
  punctuation: "#abb2bf",
};

export function highlightPalette(dark: boolean): HighlightPalette {
  return dark ? DARK : LIGHT;
}

/**
 * 高亮的 CSS 规则。
 *
 * `scope` 是选择器前缀，用来把规则限制在某个容器里（小红书卡片、编辑器预览各有各的根）。
 */
export function highlightCss(dark: boolean, scope: string): string {
  const palette = highlightPalette(dark);
  return HIGHLIGHT_TOKENS.map(
    (token) => `${scope} .${highlightClass(token)} { color: ${palette[token]}; }`,
  ).join("\n");
}

/** 元素身上的高亮 class 对应哪一档语义；不是高亮片段时返回 null。 */
export function highlightTokenOf(element: Element): HighlightToken | null {
  for (const token of HIGHLIGHT_TOKENS) {
    if (element.classList.contains(highlightClass(token))) return token;
  }
  return null;
}
