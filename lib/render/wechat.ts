import { sanitizeHtml } from "@/lib/markdown/parse";
import { appendHeadingNumbers } from "@/lib/render/heading-number";
import {
  getWechatTheme,
  wechatFontStack,
  type HeadingTemplate,
  type IdentityCardStyle,
  type StrongHighlightHeight,
  type TailGuideStyle,
  type WechatHeadingLevelStyle,
  type WechatStyle,
} from "@/lib/themes/wechat";
import type { UserProfile } from "@/lib/user-profile";

/**
 * LovType 同源思路的公众号转换器：Markdown 消毒后的 HTML 只经过 DOM 后处理，
 * 所有最终样式都写入 inline style，预览、剪贴板和下载共用同一份产物。
 */

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
const STRIP_ATTRS = ["class", "id", "loading", "crossorigin", "referrerpolicy", "srcset"];

interface Palette {
  heading: string;
  titleBg: string;
  titleText: string;
  sectionBg: string;
  text: string;
  accent: string;
  muted: string;
  border: string;
  quoteBackground: string;
  codeBackground: string;
  codeText: string;
  inlineCodeBackground: string;
  inlineCodeColor: string;
  link: string;
  tableHeaderBackground: string;
  pageBackground: string;
}

function paletteFor(style: WechatStyle): Palette {
  const theme = getWechatTheme(style.themeId);
  const p = theme.palette;
  return {
    heading: p.headingColor,
    titleBg: p.titleBg,
    titleText: p.titleColor,
    sectionBg: p.sectionBg,
    text: style.textColor,
    accent: style.accentColor,
    muted: p.mutedColor,
    border: p.borderColor,
    quoteBackground: style.quoteBackground || p.quoteBackground,
    codeBackground: style.codeBackground || (style.codeStyle === "dark" ? "#16181d" : p.codeBackground),
    codeText: style.codeTextColor || (style.codeStyle === "dark" ? "#e6e6e6" : p.codeText),
    inlineCodeBackground: style.inlineCodeBackground || p.inlineCodeBackground,
    inlineCodeColor: style.inlineCodeColor || p.inlineCodeColor,
    link: style.linkColor || p.linkColor,
    tableHeaderBackground: p.tableHeaderBackground,
    pageBackground: style.pageBackground,
  };
}

function css(declarations: Record<string, string | number | undefined>): string {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function rgba(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return hex;
  const value = Number.parseInt(clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export function wechatRootStyle(style: WechatStyle): string {
  const palette = paletteFor(style);
  return css({
    "font-family": wechatFontStack(style.fontFamily),
    "font-size": `${style.fontSize}px`,
    "line-height": style.lineHeight,
    color: palette.text,
    "letter-spacing": `${style.letterSpacing}px`,
    "word-break": "break-word",
    "text-align": "left",
    "box-sizing": "border-box",
    "max-width": "100%",
    padding: `${style.pagePadding}px`,
    background: palette.pageBackground,
  });
}

interface HeadingSpec {
  background?: string;
  color?: string;
  padding?: string;
  radius?: string;
  borderLeft?: string;
  borderBottom?: string;
  letterSpacing?: string;
}

function headingSpec(template: HeadingTemplate, level: number, palette: Palette): HeadingSpec {
  const h1 = level === 1;
  const h2 = level === 2;
  switch (template) {
    case "highlight":
      return h1
        ? { background: palette.titleBg, color: palette.titleText, padding: "10px 16px", radius: "6px", letterSpacing: "2px" }
        : h2
          ? { background: palette.sectionBg, color: palette.heading, padding: "8px 14px", radius: "4px" }
          : {};
    case "underline":
      return { borderBottom: level <= 2 ? `2px solid ${palette.accent}` : `1px dashed ${palette.accent}`, padding: "0 0 6px" };
    case "accent":
      return h1
        ? {}
        : { borderLeft: `${h2 ? 4 : 2}px solid ${palette.accent}`, padding: `0 0 0 ${h2 ? 12 : 10}px` };
    case "block":
      return h1
        ? { background: palette.titleBg, color: palette.titleText, padding: "10px 16px", radius: "6px", letterSpacing: "2px" }
        : h2
          ? { background: palette.sectionBg, borderLeft: `4px solid ${palette.accent}`, padding: "8px 14px", radius: "4px" }
          : {};
    case "elegant":
      return h1
        ? { borderBottom: `1px dashed ${palette.accent}`, padding: "0 0 6px", letterSpacing: "2px" }
        : h2
          ? { background: palette.sectionBg, padding: "8px 14px", radius: "4px" }
          : { borderLeft: `2px solid ${palette.accent}`, padding: "0 0 0 10px" };
    case "modern":
      return h1
        ? { background: palette.titleBg, color: palette.titleText, padding: "10px 16px", radius: "6px", letterSpacing: "2px" }
        : h2
          ? { borderBottom: `2px solid ${palette.accent}`, padding: "0 0 6px" }
          : { borderLeft: `2px solid ${palette.accent}`, padding: "0 0 0 10px" };
    case "minimal":
      return h1 ? { letterSpacing: "2px" } : h2 ? { borderLeft: `2px solid ${palette.accent}`, padding: "0 0 0 10px" } : {};
    default:
      return {};
  }
}

/** H1/H2/H3 各自独立配置；H4-H6 沿用 H3，避免为很少出现的层级单独加控件。 */
function headingLevelStyle(level: number, style: WechatStyle): WechatHeadingLevelStyle {
  if (level === 1) return style.headings.h1;
  if (level === 2) return style.headings.h2;
  return style.headings.h3;
}

function headingStyle(level: number, style: WechatStyle, palette: Palette): string {
  const offsets = [9, 5, 3, 1, 0, -1];
  const baseMargins: Array<[number, number]> = [[28, 18], [24, 14], [20, 10], [18, 10], [18, 10], [18, 10]];
  const [mt, mb] = baseMargins[level - 1];
  const levelStyle = headingLevelStyle(level, style);
  const legacyTemplates = {
    plain: "minimal",
    bar: "accent",
    underline: "underline",
    badge: "highlight",
  } as const;
  const template = style.headingStyle
    ? legacyTemplates[style.headingStyle]
    : style.headingTemplate;
  const spec = headingSpec(template, level, palette);
  // 用户为该层级单独设置了底色/文字色时，整体覆盖模板给出的配色，同小红书的行为保持一致。
  const background = levelStyle.background || spec.background;
  return css({
    "font-size": `${Math.round((style.fontSize + offsets[level - 1]) * levelStyle.scale)}px`,
    "font-weight": levelStyle.weight,
    "line-height": level <= 2 ? 1.45 : 1.4,
    margin: `${Math.round(mt * levelStyle.spacing)}px 0 ${Math.round(mb * levelStyle.spacing)}px`,
    color: levelStyle.textColor || spec.color || palette.heading,
    "text-align": levelStyle.align,
    "letter-spacing": spec.letterSpacing || "1px",
    background,
    padding: levelStyle.background ? "0.2em 0.44em" : spec.padding,
    "border-radius": levelStyle.background ? "0.24em" : spec.radius,
    "border-left": spec.borderLeft,
    "border-bottom": spec.borderBottom,
  });
}

/** 编辑器内的样式选项预览与实际渲染共用这份计算，避免图标和真实效果对不上。 */
export function strongHighlightBackground(
  color: string,
  height: StrongHighlightHeight,
  opacity: number,
): string | undefined {
  if (!color) return undefined;
  const fill = rgba(color, opacity);
  if (height === "full") return fill;

  const bands: Record<Exclude<StrongHighlightHeight, "full">, { size: number; position: "top" | "center" | "bottom" }> = {
    top: { size: 12, position: "top" },
    "half-top": { size: 50, position: "top" },
    "half-center": { size: 50, position: "center" },
    "half-bottom": { size: 50, position: "bottom" },
    "third-top": { size: 33, position: "top" },
    "third-center": { size: 34, position: "center" },
    "third-bottom": { size: 33, position: "bottom" },
    "quarter-top": { size: 25, position: "top" },
    "quarter-center": { size: 25, position: "center" },
    "quarter-bottom": { size: 25, position: "bottom" },
    bottom: { size: 12, position: "bottom" },
  };
  const band = bands[height];
  if (band.position === "top") {
    return `linear-gradient(to bottom, ${fill} ${band.size}%, transparent ${band.size}%)`;
  }
  if (band.position === "bottom") {
    return `linear-gradient(to top, ${fill} ${band.size}%, transparent ${band.size}%)`;
  }
  const start = Math.round((100 - band.size) / 2);
  const end = start + band.size;
  return `linear-gradient(to bottom, transparent ${start}%, ${fill} ${start}%, ${fill} ${end}%, transparent ${end}%)`;
}

function styleForElement(el: Element, style: WechatStyle, palette: Palette): string | null {
  const tag = el.tagName.toLowerCase();
  const gap = style.paragraphSpacing;
  if (/^h[1-6]$/.test(tag)) return headingStyle(Number(tag[1]), style, palette);

  switch (tag) {
    case "p":
      return css({ margin: `${gap}px 0`, "line-height": style.lineHeight, color: palette.text, "font-weight": style.fontWeight, "letter-spacing": `${style.letterSpacing}px`, "text-indent": style.textIndent ? "2em" : undefined });
    case "strong":
    case "b":
      return css({
        "font-weight": 700,
        color: style.strongColor || palette.heading,
        background: strongHighlightBackground(
          style.strongHighlight,
          style.strongHighlightHeight,
          style.strongHighlightOpacity,
        ),
        padding: style.strongHighlight ? "1px 4px" : undefined,
        "border-radius": style.strongHighlightHeight === "full" ? "2px" : undefined,
      });
    case "em":
    case "i":
      return css({ "font-style": "italic", color: style.italicColor || undefined });
    case "del":
    case "s":
      return css({ "text-decoration": "line-through", color: style.deleteColor });
    case "a":
      return css({ color: style.linkColor || palette.accent, "text-decoration": "none", "border-bottom": style.linkUnderline === "none" ? "none" : `1px ${style.linkUnderline} ${style.linkColor || palette.accent}`, "word-break": "break-all" });
    case "ul":
    case "ol":
      return css({ margin: `${gap}px 0`, "padding-left": `${style.listPadding}px`, "list-style-type": tag === "ul" ? style.unorderedListStyle : style.orderedListStyle, color: palette.text });
    case "li":
      return css({ margin: `${style.listSpacing}px 0`, "line-height": style.lineHeight, color: palette.text, "font-weight": style.fontWeight, "letter-spacing": `${style.letterSpacing}px` });
    case "blockquote":
      return style.quoteStyle === "card"
        ? css({ margin: `${style.quoteSpacing}px 0`, padding: `${style.quotePadding}px 16px`, background: palette.quoteBackground, "border-radius": `${style.quoteRadius}px`, color: palette.muted, "font-size": `${style.fontSize - 1}px`, "line-height": style.lineHeight })
        : css({ margin: `${style.quoteSpacing}px 0`, padding: `${style.quotePadding}px 16px`, "border-left": `${style.quoteBorderWidth}px solid ${style.quoteBorderColor || palette.accent}`, background: palette.quoteBackground, "border-radius": `${style.quoteRadius}px`, color: palette.muted, "font-size": `${style.fontSize - 1}px`, "line-height": style.lineHeight });
    case "pre":
      return css({ margin: `${gap}px 0`, padding: "16px", background: palette.codeBackground, color: palette.codeText, "border-radius": `${style.codeRadius}px`, "font-family": MONO, "font-size": `${style.codeFontSize}px`, "line-height": 1.6, "white-space": "pre-wrap", "word-break": "break-all", "overflow-x": "auto" });
    case "code":
      return el.parentElement?.tagName.toLowerCase() === "pre"
        ? css({ "font-family": MONO, background: "transparent", color: "inherit", padding: "0", "font-size": "inherit" })
        : css({ "font-family": MONO, background: palette.inlineCodeBackground, color: palette.inlineCodeColor, padding: "2px 6px", "border-radius": "3px", "font-size": `${style.fontSize - 2}px` });
    case "hr":
      return css({ margin: `${gap + 12}px 0`, border: "none", "border-top": `1px solid ${palette.border}`, height: "0" });
    case "img":
      return css({ "max-width": "100%", height: "auto", display: "block", margin: `${gap}px auto`, "border-radius": "4px" });
    case "table":
      return css({ width: "100%", margin: `${gap}px 0`, "border-collapse": "collapse", "font-size": `${style.fontSize - 2}px`, background: palette.pageBackground });
    case "th":
      return css({ border: `1px solid ${palette.border}`, background: palette.tableHeaderBackground, padding: "8px 12px", "font-weight": 700, "text-align": "left" });
    case "td":
      return css({ border: `1px solid ${palette.border}`, padding: "8px 12px", "text-align": "left", color: palette.text });
    default:
      return null;
  }
}

function resolveCardColors(background: string, text: string, palette: Palette) {
  const bg = background || palette.titleBg;
  return { bg, text: text || palette.titleText };
}

/** YIQ 亮度判定；非 6 位 hex（渐变、颜色关键字等）一律当浅色处理，宁可用深色字也不要糊掉。 */
function isLightColor(color: string): boolean {
  const clean = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return true;
  const value = Number.parseInt(clean, 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

const CARD_INK_DARK = "#111827";
const CARD_INK_LIGHT = "#ffffff";

interface CardPalette {
  bg: string;
  title: string;
  text: string;
  subtle: string;
  badge: string;
  badgeBorder: string;
  decorator: string;
  divider: string;
  avatarBg: string;
  avatarBorder: string;
}

/**
 * 身份卡片的多层配色。
 *
 * 文字色留空时：沿用主题背景就取主题配好的 titleColor；一旦用户自定义了背景色，
 * 就按背景明暗自动翻转墨色，避免出现浅底白字这种直接看不见的组合。
 */
function identityCardPalette(config: IdentityCardStyle, palette: Palette): CardPalette {
  const bg = config.backgroundColor.trim() || palette.titleBg;
  const light = isLightColor(bg);
  const custom = config.textColor.trim();
  const base = custom || (config.backgroundColor.trim() ? (light ? CARD_INK_DARK : CARD_INK_LIGHT) : palette.titleText);
  return {
    bg,
    title: base,
    text: rgba(base, 0.85),
    subtle: rgba(base, 0.65),
    badge: rgba(base, 0.9),
    badgeBorder: rgba(base, light ? 0.24 : 0.45),
    decorator: rgba(base, 0.55),
    divider: rgba(base, 0.18),
    avatarBg: rgba(base, light ? 0.08 : 0.2),
    avatarBorder: rgba(base, 0.3),
  };
}

/**
 * 身份卡片作者区。
 *
 * 公众号编辑器对 flex 的支持很不稳（gap 会被吃掉、粘贴后常塌成竖排），
 * 这里统一用 inline-block + vertical-align 排版，代价是要手动收掉行高空隙。
 */
function buildAuthorSection(
  doc: Document,
  config: IdentityCardStyle,
  colors: CardPalette,
  fontSize: number,
): HTMLElement[] {
  if (!config.nickname && !config.tag && !config.avatarUrl) return [];
  const center = config.authorAlign === "center";
  const right = config.authorAlign === "right";

  const divider = doc.createElement("section");
  divider.setAttribute("style", css({ border: "none", "border-top": `1px solid ${colors.divider}`, margin: "18px 0 16px", height: "0" }));

  const avatarBox = css({ display: "inline-block", width: "44px", height: "44px", "border-radius": "50%", "object-fit": "cover", background: colors.avatarBg, border: `2px solid ${colors.avatarBorder}`, color: colors.title, "font-size": "18px", "line-height": "44px", "text-align": "center" });
  const avatar = doc.createElement(config.avatarUrl ? "img" : "span");
  if (config.avatarUrl) {
    avatar.setAttribute("src", config.avatarUrl);
    avatar.setAttribute("alt", config.nickname);
  } else {
    avatar.textContent = config.nickname.charAt(0) || "?";
  }
  avatar.setAttribute("style", avatarBox);

  const nameSize = fontSize;
  const tagSize = Math.max(Math.round(fontSize * 0.8), 11);
  const texts: HTMLElement[] = [];
  if (config.nickname) {
    const name = doc.createElement("span");
    name.textContent = config.nickname;
    name.setAttribute("style", css({ display: "block", margin: "0", color: colors.title, "font-size": `${nameSize}px`, "font-weight": 700, "line-height": 1.4 }));
    texts.push(name);
  }
  if (config.tag) {
    const tag = doc.createElement("span");
    tag.textContent = config.tag;
    tag.setAttribute("style", css({ display: "block", margin: "2px 0 0", color: colors.subtle, "font-size": `${tagSize}px`, "line-height": 1.4 }));
    texts.push(tag);
  }

  const row = doc.createElement("section");
  const avatarHolder = doc.createElement("span");
  avatarHolder.setAttribute("style", css({ display: "inline-block", "vertical-align": "middle" }));
  avatarHolder.appendChild(avatar);

  if (center) {
    row.setAttribute("style", css({ margin: "0", "text-align": "center" }));
    row.appendChild(avatarHolder);
    if (texts.length) {
      const meta = doc.createElement("section");
      meta.setAttribute("style", css({ margin: "8px 0 0", "text-align": "center" }));
      texts.forEach((el) => meta.appendChild(el));
      row.appendChild(meta);
    }
    return [divider, row];
  }

  row.setAttribute("style", css({ margin: "0", "line-height": 0, "text-align": config.authorAlign }));
  const meta = doc.createElement("span");
  meta.setAttribute("style", css({ display: "inline-block", "vertical-align": "middle", [right ? "margin-right" : "margin-left"]: "12px", "text-align": config.authorAlign }));
  texts.forEach((el) => meta.appendChild(el));
  if (right) {
    if (texts.length) row.appendChild(meta);
    row.appendChild(avatarHolder);
  } else {
    row.appendChild(avatarHolder);
    if (texts.length) row.appendChild(meta);
  }
  return [divider, row];
}

/** 身份卡片副标题的兜底长度：超出就截断成摘要，避免整段正文被搬到卡片里。 */
const DERIVED_SUBTITLE_MAX = 54;

/**
 * 从正文里推导身份卡片留空字段的兜底内容。
 *
 * 标题取第一个一级标题；副标题取它后面的第一段正文，过长时截断成摘要。
 * 必须在 hideTitle 摘掉 h1 之前调用。
 */
export function deriveIdentityCardContent(holder: HTMLElement): { title: string; subtitle: string } {
  const heading = holder.querySelector("h1");
  // 没有一级标题就没有「标题 + 导语」这个结构，硬取首段只会把正文原样搬到卡片上重复一遍。
  if (!heading) return { title: "", subtitle: "" };
  let node = heading.nextElementSibling;
  while (node && node.tagName.toLowerCase() !== "p") node = node.nextElementSibling;
  const raw = node?.textContent?.trim() ?? "";
  const subtitle = raw.length > DERIVED_SUBTITLE_MAX ? `${raw.slice(0, DERIVED_SUBTITLE_MAX)}…` : raw;
  return { title: heading.textContent?.trim() ?? "", subtitle };
}

function buildIdentityCard(
  doc: Document,
  config: IdentityCardStyle,
  palette: Palette,
  fontSize: number,
  lineHeight: number,
): HTMLElement | null {
  if (!config.enabled) return null;
  const colors = identityCardPalette(config, palette);
  const parts: HTMLElement[] = [];
  if (config.badge) {
    const row = doc.createElement("p");
    row.setAttribute("style", css({ margin: "0 0 20px", "text-align": config.badgeAlign }));
    const badge = doc.createElement("span");
    badge.textContent = config.badge;
    badge.setAttribute("style", css({ display: "inline-block", padding: "4px 14px", border: `1px solid ${colors.badgeBorder}`, "border-radius": "999px", color: colors.badge, "font-size": `${Math.max(Math.round(fontSize * 0.8), 11)}px`, "letter-spacing": "2px", "text-transform": "uppercase" }));
    row.appendChild(badge);
    parts.push(row);
  }
  if (config.title) {
    const title = doc.createElement("p");
    title.textContent = config.title;
    title.setAttribute("style", css({ margin: "0 0 16px", color: colors.title, "font-size": `${config.titleFontSize}px`, "font-weight": 800, "line-height": 1.35, "letter-spacing": "1px", "text-align": config.titleAlign }));
    parts.push(title);
  }
  if (config.title && (config.subtitle || config.slogan)) {
    const line = doc.createElement("section");
    line.setAttribute("style", css({ display: "block", width: "40px", height: "3px", "line-height": 0, "font-size": 0, overflow: "hidden", background: colors.decorator, "border-radius": "2px", border: "none", margin: config.titleAlign === "center" ? "0 auto 16px" : config.titleAlign === "right" ? "0 0 16px auto" : "0 0 16px" }));
    parts.push(line);
  }
  if (config.subtitle) {
    const subtitle = doc.createElement("p");
    subtitle.textContent = config.subtitle;
    subtitle.setAttribute("style", css({ margin: "0 0 8px", color: colors.text, "font-size": `${config.subtitleFontSize}px`, "line-height": lineHeight, "letter-spacing": "0.5px", "text-align": config.subtitleAlign }));
    parts.push(subtitle);
  }
  if (config.slogan) {
    const slogan = doc.createElement("p");
    slogan.textContent = config.slogan;
    slogan.setAttribute("style", css({ margin: "0 0 8px", color: colors.subtle, "font-size": `${Math.max(config.subtitleFontSize - 1, 12)}px`, "font-style": "italic", "line-height": lineHeight, "letter-spacing": "0.5px", "text-align": config.sloganAlign }));
    parts.push(slogan);
  }
  parts.push(...buildAuthorSection(doc, config, colors, fontSize));
  // 字段全空时不要留一个纯色块在正文顶上。
  if (!parts.length) return null;

  const card = doc.createElement("section");
  card.setAttribute("data-wechat-card", "identity");
  card.setAttribute("style", css({ padding: "24px", margin: "0 0 16px", background: colors.bg, color: colors.title, "border-radius": `${config.borderRadius}px`, "box-sizing": "border-box" }));
  parts.forEach((el) => card.appendChild(el));
  return card;
}

function buildTailGuide(doc: Document, config: TailGuideStyle, identity: IdentityCardStyle, palette: Palette): HTMLElement | null {
  if (!config.enabled) return null;
  const colors = resolveCardColors(config.backgroundColor, config.textColor, palette);
  const card = doc.createElement("section");
  card.setAttribute("data-wechat-card", "tail-guide");
  const activeColor = colors.bg;
  const tint = rgba(activeColor, 0.12);
  card.setAttribute("style", css({ padding: "24px", margin: "28px 0 0", background: tint, color: colors.text, "border-radius": `${identity.enabled ? identity.borderRadius : 16}px`, "text-align": "center", "box-sizing": "border-box" }));
  const title = doc.createElement("p");
  title.textContent = config.title;
  title.setAttribute("style", css({ margin: "0 0 14px", color: colors.text, "font-size": "15px", "font-weight": 700 }));
  card.appendChild(title);
  const actions = doc.createElement("div");
  actions.setAttribute("style", css({ display: "flex", "justify-content": "space-between", gap: "10px" }));
  [
    [config.likeEmoji, config.likeText, config.likeHighlight],
    [config.starEmoji, config.starText, config.starHighlight],
    [config.readEmoji, config.readText, config.readHighlight],
  ].forEach(([emoji, label, highlighted]) => {
    const item = doc.createElement("span");
    item.setAttribute("style", css({ display: "inline-flex", width: "31%", "flex-direction": "column", "align-items": "center", color: colors.text, "font-size": "13px", "font-weight": highlighted ? 600 : 400 }));
    const circle = doc.createElement("span");
    circle.textContent = String(emoji);
    circle.setAttribute("style", css({ display: "inline-flex", width: "58px", height: "58px", "align-items": "center", "justify-content": "center", margin: "0 0 10px", "border-radius": "50%", background: highlighted ? activeColor : rgba(activeColor, 0.15), color: highlighted ? colors.text : activeColor, "font-size": "24px", "line-height": 1 }));
    const text = doc.createElement("span");
    text.textContent = String(label);
    item.append(circle, text);
    actions.appendChild(item);
  });
  card.appendChild(actions);
  if (identity.enabled && config.authorAlign !== "hidden" && (identity.avatarUrl || identity.nickname)) {
    const author = doc.createElement("div");
    author.setAttribute("style", css({ display: "flex", "flex-direction": config.authorAlign === "center" ? "column" : config.authorAlign === "right" ? "row-reverse" : "row", "align-items": "center", "justify-content": config.authorAlign === "center" ? "center" : config.authorAlign === "right" ? "flex-start" : "flex-start", gap: "10px", margin: "18px 0 0", padding: "16px 0 0", "border-top": `1px solid ${rgba(activeColor, 0.18)}`, "text-align": config.authorAlign }));
    const avatar = doc.createElement(identity.avatarUrl ? "img" : "span");
    if (identity.avatarUrl) {
      avatar.setAttribute("src", identity.avatarUrl);
      avatar.setAttribute("alt", identity.nickname);
    } else {
      avatar.textContent = identity.nickname.charAt(0) || "?";
    }
    avatar.setAttribute("style", css({ display: "inline-block", width: "44px", height: "44px", "border-radius": "50%", "object-fit": "cover", background: rgba(activeColor, 0.12), border: `2px solid ${rgba(activeColor, 0.28)}`, color: activeColor, "font-size": "18px", "line-height": "40px", "text-align": "center" }));
    const meta = doc.createElement("span");
    meta.textContent = [identity.nickname, identity.tag].filter(Boolean).join(" · ");
    meta.setAttribute("style", css({ color: activeColor, "font-size": "13px", "font-weight": 700 }));
    author.append(avatar, meta);
    card.appendChild(author);
  }
  if (config.footerText) {
    const footer = doc.createElement("p");
    footer.textContent = config.footerText;
    footer.setAttribute("style", css({ margin: "14px 0 0", color: colors.text, "font-size": "9px", "letter-spacing": "2px", opacity: 0.5 }));
    card.appendChild(footer);
  }
  return card;
}

export interface WechatRenderResult {
  html: string;
  plainText: string;
  warnings: WechatWarning[];
  issues: WechatCompatibilityIssue[];
}

export type WechatWarning = "wechat.compatTable" | "wechat.compatCode" | "wechat.compatLink" | "wechat.compatImage";

export interface WechatCompatibilityIssue {
  warning: WechatWarning;
  index: number;
  preview: string;
  /** 能在 Markdown 原文中搜索到的短文本，用于从提醒跳回编辑器。 */
  searchText: string;
}

const EMPTY_RESULT: WechatRenderResult = {
  html: "",
  plainText: "",
  warnings: [],
  issues: [],
};

function compatibilityText(el: Element, warning: WechatWarning): {
  preview: string;
  searchText: string;
} {
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (warning === "wechat.compatLink") {
    const href = el.getAttribute("href") ?? "";
    return {
      preview: [text, href].filter(Boolean).join(" · ").slice(0, 96),
      searchText: text || href,
    };
  }
  if (warning === "wechat.compatImage") {
    const alt = el.getAttribute("alt")?.trim() ?? "";
    const src = el.getAttribute("src") ?? "";
    return {
      preview: [alt, src].filter(Boolean).join(" · ").slice(0, 96),
      searchText: alt || src,
    };
  }
  return {
    preview: text.slice(0, 96),
    searchText: text.slice(0, 48),
  };
}

export function renderWechat(
  sanitizedHtml: string,
  style: WechatStyle,
  profile?: UserProfile,
): WechatRenderResult {
  if (!sanitizedHtml.trim() || typeof window === "undefined") return EMPTY_RESULT;
  const palette = paletteFor(style);
  const holder = window.document.createElement("div");
  // 不完全依赖调用方「已经消毒过」的命名约定，这里再兜底消毒一次（纵深防御）。
  holder.appendChild(sanitizeHtml(sanitizedHtml));
  // 卡片留空的字段从正文里兜底：标题取第一个一级标题，副标题取紧随其后的第一段。
  const derived = deriveIdentityCardContent(holder);
  const subtitleFromBody = !style.identityCard.subtitle.trim() && Boolean(derived.subtitle);
  const identityCard: IdentityCardStyle = {
    ...style.identityCard,
    title: style.identityCard.title.trim() || derived.title,
    subtitle: style.identityCard.subtitle.trim() || derived.subtitle,
    ...(profile
      ? {
          avatarUrl: profile.avatar,
          nickname: profile.name,
          slogan: profile.slogan,
        }
      : {}),
  };
  const warnings = new Set<WechatWarning>();
  const issues: WechatCompatibilityIssue[] = [];
  const issueCounts = new Map<WechatWarning, number>();

  const addIssue = (warning: WechatWarning, el: Element) => {
    warnings.add(warning);
    const index = (issueCounts.get(warning) ?? 0) + 1;
    issueCounts.set(warning, index);
    issues.push({ warning, index, ...compatibilityText(el, warning) });
  };

  // hideTitle 的语义是「卡片接管文章开头」：既然标题挪进了卡片，
  // 被自动提升成副标题的那段导语也要从正文摘掉，否则开头会原样重复一遍。
  if (identityCard.enabled && identityCard.hideTitle) {
    const heading = holder.querySelector("h1");
    if (heading && subtitleFromBody) {
      let node = heading.nextElementSibling;
      while (node && node.tagName.toLowerCase() !== "p") node = node.nextElementSibling;
      node?.remove();
    }
    heading?.remove();
  }
  holder.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "table") addIssue("wechat.compatTable", el);
    if (tag === "pre") addIssue("wechat.compatCode", el);
    if (tag === "img") addIssue("wechat.compatImage", el);
    if (tag === "a" && /^https?:/i.test(el.getAttribute("href") ?? "")) {
      addIssue("wechat.compatLink", el);
    }
    for (const attr of STRIP_ATTRS) el.removeAttribute(attr);
    if (tag === "input") {
      el.replaceWith(window.document.createTextNode(el.hasAttribute("checked") ? "☑ " : "☐ "));
      return;
    }
    const inline = styleForElement(el, style, palette);
    if (inline) el.setAttribute("style", inline);
  });

  appendHeadingNumbers(holder, style.headings, style.fontSize, palette.accent);
  const section = window.document.createElement("section");
  section.setAttribute("style", wechatRootStyle(style));
  section.innerHTML = holder.innerHTML;
  const identity = buildIdentityCard(window.document, identityCard, palette, style.fontSize, style.lineHeight);
  if (identity) section.insertBefore(identity, section.firstChild);
  const guide = buildTailGuide(window.document, style.tailGuide, identityCard, palette);
  if (guide) section.appendChild(guide);

  const first = section.firstElementChild as HTMLElement | null;
  const last = section.lastElementChild as HTMLElement | null;
  if (first && !first.hasAttribute("data-wechat-card")) first.style.marginTop = "0";
  if (last && !last.hasAttribute("data-wechat-card")) last.style.marginBottom = "0";
  return {
    html: section.outerHTML,
    plainText: toPlainText(holder),
    warnings: [...warnings],
    issues,
  };
}

function toPlainText(holder: HTMLElement): string {
  return Array.from(holder.childNodes)
    .map((node) => (node.textContent ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function buildWechatDocument(bodyHtml: string, title: string): string {
  const safeTitle = title.replace(/[<>&]/g, (char) => char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&amp;");
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f5"><div style="max-width:677px;margin:0 auto">${bodyHtml}</div></body>
</html>`;
}
