import { DIAGRAM_CLASS } from "@/lib/markdown/diagram";
import { sanitizeHtml } from "@/lib/markdown/parse";
import { appendHeadingNumbers } from "@/lib/render/heading-number";
import { highlightCss } from "@/lib/themes/highlight";
import { fontStack } from "@/lib/themes/types";
import { isDarkColor } from "@/lib/utils";
import {
  getXhsCanvasSize,
  getXhsTheme,
  type XhsHeadingLevelStyle,
  type XhsStyle,
} from "@/lib/themes/xhs";

/**
 * 小红书卡片样式。
 *
 * 预览和 PNG 导出使用完全相同的 DOM 与这份 CSS，预览只是外层加了 transform 缩放，
 * 所以不会出现「预览好看、导出走样」（PRD FT-XHS-005 / 12.3）。
 */

export const XHS_CARD_CLASS = "ft-xhs-card";
const XHS_PAGE_NUMBER_BASE_SIZE = 14;
const XHS_PAGE_NUMBER_EDGE_MARGIN = 32;
const XHS_FOOTER_TOP_GAP = 20;
export const XHS_FOOTER_ACCESSORY_GAP = 16;

function xhsPageNumberFontSize(style: Pick<XhsStyle, "pageNumberScale">): number {
  return Math.round(XHS_PAGE_NUMBER_BASE_SIZE * style.pageNumberScale * 10) / 10;
}

/** 页脚在正文流中独占的高度，供分页与底部附加元素共同避让。 */
export function xhsFooterBlockHeight(
  style: Pick<XhsStyle, "showPageNumber" | "pageNumberScale">,
): number {
  return style.showPageNumber ? Math.ceil(xhsPageNumberFontSize(style) + XHS_FOOTER_TOP_GAP) : 0;
}

export interface XhsPalette {
  background: string;
  text: string;
  accent: string;
  muted: string;
  surface: string;
  border: string;
  codeBackground: string;
  codeColor: string;
  tableHeaderBackground: string;
  strong: string;
  italic: string;
  link: string;
  quoteBorder: string;
  quoteRadius: number;
  quoteItalic: boolean;
  codeBorder: string;
  codeRadius: number;
  inlineCodeBackground: string;
  inlineCodeColor: string;
  hr: string;
  imageRadius: number;
}

export function xhsPalette(style: XhsStyle): XhsPalette {
  const theme = getXhsTheme(style.themeId);
  return {
    background: style.background,
    text: style.textColor,
    accent: style.accentColor,
    muted: theme.derived.mutedColor,
    surface: theme.derived.surface,
    border: theme.derived.borderColor,
    codeBackground: theme.derived.codeBackground,
    codeColor: theme.derived.codeColor,
    tableHeaderBackground: theme.derived.tableHeaderBackground,
    strong: theme.derived.strongColor,
    italic: theme.derived.italicColor,
    link: theme.derived.linkColor,
    quoteBorder: theme.derived.quoteBorderColor,
    quoteRadius: theme.derived.quoteRadius,
    quoteItalic: theme.derived.quoteItalic,
    codeBorder: theme.derived.codeBorderColor,
    codeRadius: theme.derived.codeRadius,
    inlineCodeBackground: theme.derived.inlineCodeBackground,
    inlineCodeColor: theme.derived.inlineCodeColor,
    hr: theme.derived.hrColor,
    imageRadius: theme.derived.imageRadius,
  };
}

/** 卡片内容区宽度，分页测量必须用同一个值。 */
export function contentWidth(style: XhsStyle): number {
  return getXhsCanvasSize(style).width - style.padding * 2;
}

/**
 * 在分页测量之前给标题插入自动编号，这样编号会和标题正文一起被分页克隆，
 * 预览和导出天然共用同一份结果（呼应 PRD FT-XHS-005 的“同一套渲染配置”）。
 */
export function applyXhsHeadingNumbers(
  html: string,
  // 只收真正用得上的三项：调用方据此把重算依赖收窄到这几个字段，改配色不会白跑一遍编号。
  style: Pick<XhsStyle, "headings" | "fontSize" | "accentColor">,
): string {
  const hasNumbering = (["h1", "h2", "h3"] as const).some(
    (tag) => style.headings[tag].number.enabled,
  );
  if (!hasNumbering || !html.trim() || typeof window === "undefined") return html;
  const holder = window.document.createElement("div");
  // 不完全依赖调用方「已经消毒过」的命名约定，这里再兜底消毒一次（纵深防御）。
  holder.appendChild(sanitizeHtml(html));
  appendHeadingNumbers(holder, style.headings, style.fontSize, style.accentColor);
  return holder.innerHTML;
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 用用户在样式设置里填写的自定义标题替换正文里第一个 H1 的文字，不改动 Markdown 原文。
 * Markdown 正文没有一级标题时，会在最前面补一个，方便用户完全脱离正文自定义标题。
 */
export function applyXhsBodyTitleOverride(html: string, override: string): string {
  const trimmed = override.trim();
  if (!trimmed || typeof window === "undefined") return html;
  const holder = window.document.createElement("div");
  // 不完全依赖调用方「已经消毒过」的命名约定，这里再兜底消毒一次（纵深防御）。
  holder.appendChild(sanitizeHtml(html));
  const innerHtml = trimmed.split("\n").map(escapeHtmlText).join("<br>");
  const heading = holder.querySelector("h1");
  if (heading) {
    heading.innerHTML = innerHtml;
  } else {
    const h1 = window.document.createElement("h1");
    h1.innerHTML = innerHtml;
    holder.insertBefore(h1, holder.firstChild);
  }
  return holder.innerHTML;
}

function headingDecorationCss(style: XhsStyle, p: XhsPalette, root: string): string {
  const headings = `${root} h1, ${root} h2, ${root} h3`;
  const headingBefore = `${root} h1::before, ${root} h2::before, ${root} h3::before`;
  const headingAfter = `${root} h1::after, ${root} h2::after, ${root} h3::after`;
  switch (style.headingTemplate) {
    case "highlight":
      return `
${root} h1 { padding: 0.28em 0.46em; border-radius: 0.28em; background: ${p.accent}; color: ${p.background}; }
${root} h2, ${root} h3 { padding: 0.22em 0.42em; border-radius: 0.24em; background: ${p.surface}; color: ${p.text}; }
${root} h2 { border-left: none; }`;
    case "underline":
      return `
${headings} { padding-bottom: 0.22em; border-bottom: 0.1em solid ${p.accent}; }
${root} h2 { border-left: none; }
${root} h3 { color: ${p.accent}; }`;
    case "accent":
      return `
${headings} { padding-left: 0.42em; border-left: 0.14em solid ${p.accent}; }
${root} h3 { color: ${p.text}; }`;
    case "block":
      return `
${headings} { width: fit-content; padding: 0.16em 0.46em; border: 0.08em solid ${p.accent}; border-radius: 999px; }
${root} h2 { border-left: 0.08em solid ${p.accent}; }
${root} h3 { color: ${p.accent}; }`;
    case "elegant":
      return `
${headings} { position: relative; display: block; box-sizing: border-box; width: 100%; padding-block: 0.32em; text-align: center; }
${headingBefore}, ${headingAfter} { content: ""; position: absolute; left: 50%; width: 1.8em; height: 0.08em; background: ${p.accent}; opacity: 0.72; transform: translateX(-50%); }
${headingBefore} { top: 0; }
${headingAfter} { bottom: 0; }
${root} h2 { border-left: none; }
${root} h3 { color: ${p.text}; }`;
    case "dot":
      return `
${headings} { position: relative; padding-left: 0.95em; }
${headingBefore} { content: ""; position: absolute; left: 0; top: 50%; width: 0.36em; height: 0.36em; border-radius: 50%; background: ${p.accent}; transform: translateY(-50%); }
${root} h2 { border-left: none; }
${root} h3 { color: ${p.accent}; }`;
    case "corner":
      return `
${headings} { position: relative; padding: 0.2em 0.7em; }
${headingBefore} { content: ""; position: absolute; top: 0; left: 0; width: 0.6em; height: 0.6em; border-top: 0.12em solid ${p.accent}; border-left: 0.12em solid ${p.accent}; }
${headingAfter} { content: ""; position: absolute; bottom: 0; right: 0; width: 0.6em; height: 0.6em; border-bottom: 0.12em solid ${p.accent}; border-right: 0.12em solid ${p.accent}; }
${root} h2 { border-left: none; }
${root} h3 { color: ${p.text}; }`;
    default:
      return "";
  }
}

/**
 * 每级标题各自的背景色 / 文字色覆盖；留空时不产生任何规则，跟随标题模板默认样式。
 * 放在 headingDecorationCss 之后输出，同选择器下靠“后声明优先”覆盖模板颜色。
 */
function headingColorOverrideCss(style: XhsStyle, root: string): string {
  const levels: Array<{ tag: "h1" | "h2" | "h3"; level: XhsHeadingLevelStyle }> = [
    { tag: "h1", level: style.headings.h1 },
    { tag: "h2", level: style.headings.h2 },
    { tag: "h3", level: style.headings.h3 },
  ];
  return levels
    .map(({ tag, level }) => {
      const declarations: string[] = [];
      if (level.background) {
        declarations.push(
          `background: ${level.background};`,
          "padding: 0.2em 0.44em;",
          "border-radius: 0.24em;",
        );
      }
      if (level.textColor) {
        declarations.push(`color: ${level.textColor};`);
      }
      return declarations.length ? `${root} ${tag} { ${declarations.join(" ")} }` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function xhsCardCss(style: XhsStyle): string {
  const p = xhsPalette(style);
  const size = style.fontSize;
  const root = `.${XHS_CARD_CLASS}`;
  const paragraphGap = Math.round(size * style.paragraphSpacing);
  const h1 = style.headings.h1;
  const h2 = style.headings.h2;
  const h3 = style.headings.h3;
  const elements = style.elements;
  const canvas = getXhsCanvasSize(style);
  const linkDecoration = elements.linkUnderline === "none" ? "none" : elements.linkUnderline;
  const footerHeight = xhsFooterBlockHeight(style);
  const footerBottomOffset = Math.max(0, style.padding - XHS_PAGE_NUMBER_EDGE_MARGIN);

  return `
${root} {
  font-family: ${fontStack(style.fontFamily)};
  font-size: ${size}px;
  font-weight: ${style.fontWeight};
  letter-spacing: ${style.letterSpacing}px;
  line-height: ${style.lineHeight};
  color: ${p.text};
  background: ${p.background};
  overflow-wrap: break-word;
  word-break: break-word;
  text-align: left;
}
${root} .ft-xhs-body > *:first-child { margin-top: 0; }
${root} .ft-xhs-body > *:last-child { margin-bottom: 0; }
${root} h1, ${root} h2, ${root} h3, ${root} h4, ${root} h5, ${root} h6 {
  font-weight: 700;
  line-height: 1.35;
  margin: ${size * 0.9}px 0 ${size * 0.5}px;
  color: ${p.text};
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
}
${root} h1 {
  font-size: ${Math.round(size * h1.scale)}px;
  font-weight: ${h1.weight};
  text-align: ${h1.align};
  margin-top: ${Math.round(size * 0.9 * h1.spacing)}px;
  margin-bottom: ${Math.round(size * 0.5 * h1.spacing)}px;
}
${root} h2 {
  font-size: ${Math.round(size * h2.scale)}px;
  font-weight: ${h2.weight};
  text-align: ${h2.align};
  margin-top: ${Math.round(size * 0.9 * h2.spacing)}px;
  margin-bottom: ${Math.round(size * 0.5 * h2.spacing)}px;
}
${root} h3 {
  font-size: ${Math.round(size * h3.scale)}px;
  font-weight: ${h3.weight};
  text-align: ${h3.align};
  margin-top: ${Math.round(size * 0.9 * h3.spacing)}px;
  margin-bottom: ${Math.round(size * 0.5 * h3.spacing)}px;
}
${root} h4, ${root} h5, ${root} h6 { font-size: ${size}px; }
${headingDecorationCss(style, p, root)}
${headingColorOverrideCss(style, root)}
${root} p { margin: 0 0 ${paragraphGap}px; text-indent: ${style.textIndent ? "2em" : "0"}; }
${root} strong {
  font-weight: 700;
  color: ${elements.strongColor};
  ${elements.strongHighlight ? `background: linear-gradient(to top, ${elements.strongHighlight} 42%, transparent 42%); padding-inline: 0.08em;` : ""}
}
${root} em { font-style: italic; color: ${elements.italicColor}; }
${root} del { text-decoration: line-through; color: ${elements.strikeColor}; }
${root} a {
  color: ${elements.linkColor};
  text-decoration-line: ${elements.linkUnderline === "none" ? "none" : "underline"};
  text-decoration-style: ${linkDecoration};
  text-underline-offset: 0.18em;
}
${root} ul, ${root} ol {
  margin: 0 0 ${paragraphGap}px;
  padding-left: ${elements.listIndent}px;
}
${root} ul { list-style: ${elements.unorderedListStyle}; }
${root} ol { list-style: ${elements.orderedListStyle}; }
${root} li { margin: 0 0 ${elements.listSpacing}px; }
${root} li::marker { color: ${p.accent}; }
${root} blockquote {
  margin: 0 0 ${paragraphGap}px;
  padding: ${elements.quotePadding}px;
  background: ${elements.quoteBackground};
  border-left: ${elements.quoteBorderWidth}px solid ${elements.quoteBorderColor};
  border-radius: ${elements.quoteRadius}px;
  color: ${p.muted};
  font-style: ${p.quoteItalic ? "italic" : "normal"};
  font-size: ${Math.round(size * 0.94)}px;
}
${root} hr {
  margin: ${size}px 0;
  border: none;
  border-top: 2px solid ${p.hr};
}
${root} code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: ${elements.inlineCodeBackground};
  color: ${elements.inlineCodeColor};
  padding: 0.1em 0.3em;
  border-radius: 0.2em;
  font-size: ${Math.round(size * 0.86)}px;
}
${root} pre {
  margin: 0 0 ${paragraphGap}px;
  padding: ${Math.round(size * 0.6)}px;
  background: ${elements.codeBackground};
  color: ${elements.codeColor};
  border: 2px solid ${p.codeBorder};
  border-radius: ${elements.codeRadius}px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: ${elements.codeFontSize}px;
  line-height: 1.55;
}
${root} pre code { background: transparent; padding: 0; font-size: inherit; }
${root} img {
  display: block;
  max-width: 100%;
  /* 单图不得超过一页，避免出现无法分页的超高块（FT-XHS-004） */
  max-height: ${Math.round(Math.min(canvas.width, canvas.height) * 0.9)}px;
  object-fit: contain;
  margin: 0 auto ${paragraphGap}px;
  border-radius: ${p.imageRadius}px;
}
/* 调过宽度或对齐的图片落成 <p align><img width>；align 管不了 block 元素的位置，靠 margin。 */
${root} p[align] { margin: 0 0 ${paragraphGap}px; text-indent: 0; }
${root} p[align] > img { display: block; margin-bottom: 0; }
${root} p[align="left"] > img { margin-left: 0; margin-right: auto; }
${root} p[align="center"] > img { margin-left: auto; margin-right: auto; }
${root} p[align="right"] > img { margin-left: auto; margin-right: 0; }
${root} table {
  width: 100%;
  margin: 0 0 ${paragraphGap}px;
  border-collapse: collapse;
  font-size: ${Math.round(size * 0.84)}px;
  table-layout: fixed;
}
${root} th, ${root} td {
  border: 2px solid ${p.border};
  padding: ${Math.round(size * 0.3)}px ${Math.round(size * 0.4)}px;
  text-align: left;
  word-break: break-word;
}
${root} th { background: ${p.tableHeaderBackground}; font-weight: 700; }
${root} .md-img-error {
  border-color: ${p.muted};
  color: ${p.muted};
  font-size: ${Math.round(size * 0.72)}px;
}
${root} .ft-xhs-title {
  font-size: ${Math.round(size * 1.5)}px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 ${Math.round(size * 0.8)}px;
  color: ${p.text};
}
${root} .ft-xhs-footer {
  position: relative;
  z-index: 5;
  flex: 0 0 ${footerHeight}px;
  min-height: ${footerHeight}px;
  display: flex;
  align-items: flex-end;
  justify-content: ${
    style.pageNumberAlign === "left"
      ? "flex-start"
      : style.pageNumberAlign === "center"
        ? "center"
        : "flex-end"
  };
  font-size: ${xhsPageNumberFontSize(style)}px;
  line-height: 1;
  color: ${p.text};
  opacity: 0.5;
  transform: translateY(${footerBottomOffset}px);
}
${root} .ft-xhs-page-dot {
  display: inline-flex;
  align-items: center;
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 400;
  white-space: nowrap;
}
${root} .${DIAGRAM_CLASS} {
  margin: 0 0 ${paragraphGap}px;
  text-align: center;
}
/*
 * 卡片是 1080 宽给手机看的，图按自己那两三百像素的自然尺寸摆上去只有指甲盖大，
 * 所以这里撑满内容宽度等比放大；和图片同一条约束，整张图不得超过一页（FT-XHS-004）。
 */
${root} .${DIAGRAM_CLASS} svg {
  width: 100%;
  height: auto;
  max-height: ${Math.round(Math.min(canvas.width, canvas.height) * 0.9)}px;
}
${root} .ft-diagram-error {
  margin: 0 0 ${Math.round(size * 0.4)}px;
  color: ${p.muted};
  font-size: ${Math.round(size * 0.78)}px;
}
${highlightCss(isDarkColor(elements.codeBackground), root)}
`.trim();
}
