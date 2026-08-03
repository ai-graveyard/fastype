import { translate, type Locale } from "@/lib/i18n";

import {
  DEFAULT_HEADING_NUMBER,
  HEADING_NUMBER_LABEL_POSITIONS,
  HEADING_NUMBER_POSITIONS,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
  type HeadingNumberStyle,
  type ThemeMeta,
} from "./types";

export {
  HEADING_NUMBER_LABEL_POSITIONS,
  HEADING_NUMBER_POSITIONS,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
  type HeadingNumberStyle,
};

export const WECHAT_FONT_STACKS = {
  sans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  serif:
    'Georgia, "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif',
  hei: '"Heiti SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  kai: '"Kaiti SC", STKaiti, KaiTi, BiauKai, "Noto Serif CJK SC", serif',
  fangsong: 'STFangsong, FangSong, "FangSong_GB2312", "Noto Serif CJK SC", serif',
  rounded:
    'ui-rounded, "Hiragino Maru Gothic ProN", "Yuanti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  xingkai: 'STXingkai, "Xingkai SC", "HanziPen SC", "Kaiti SC", STKaiti, KaiTi, cursive',
  lishu: 'STLiti, "LiSu", "Noto Serif CJK SC", SimSun, serif',
  youyuan: '"YouYuan", "Yuanti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  xinwei: 'STXinwei, "Xin Wei", "Noto Serif CJK SC", SimSun, serif',
  hupo: 'STHupo, "Heiti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
} as const;

export type WechatFontChoice = keyof typeof WECHAT_FONT_STACKS;
export const WECHAT_FONT_CHOICES = Object.keys(WECHAT_FONT_STACKS) as WechatFontChoice[];

export function isWechatFontChoice(value: unknown): value is WechatFontChoice {
  return typeof value === "string" && value in WECHAT_FONT_STACKS;
}

export function wechatFontStack(choice: WechatFontChoice): string {
  return WECHAT_FONT_STACKS[choice] ?? WECHAT_FONT_STACKS.sans;
}

export const HEADING_TEMPLATES = [
  "classic",
  "highlight",
  "underline",
  "accent",
  "block",
  "elegant",
  "modern",
  "minimal",
] as const;
export type HeadingTemplate = (typeof HEADING_TEMPLATES)[number];
/** 兼容旧配置；新界面使用 headingTemplate。 */
export type HeadingStyle = "plain" | "bar" | "underline" | "badge";

export const HEADING_ALIGNS = ["left", "center", "right"] as const;
export type HeadingAlign = (typeof HEADING_ALIGNS)[number];

export const QUOTE_STYLES = ["bar", "card"] as const;
export type QuoteStyle = (typeof QUOTE_STYLES)[number];

export const CODE_STYLES = ["light", "dark"] as const;
export type CodeStyle = (typeof CODE_STYLES)[number];

export const LINK_UNDERLINES = ["solid", "dashed", "none"] as const;
export type LinkUnderline = (typeof LINK_UNDERLINES)[number];

export const STRONG_HIGHLIGHT_HEIGHTS = [
  "full",
  "top",
  "half-top",
  "half-center",
  "half-bottom",
  "third-top",
  "third-center",
  "third-bottom",
  "quarter-top",
  "quarter-center",
  "quarter-bottom",
  "bottom",
] as const;
export type StrongHighlightHeight = (typeof STRONG_HIGHLIGHT_HEIGHTS)[number];

/** H1/H2/H3 各自独立的字号比例、间距、字重、对齐与自动编号；H4-H6 沿用 H3 的配置。 */
export interface WechatHeadingLevelStyle {
  scale: number;
  spacing: number;
  weight: number;
  align: HeadingAlign;
  number: HeadingNumberStyle;
  /** 留空时沿用当前标题模板的默认底色/文字色。 */
  background: string;
  textColor: string;
}

export interface WechatHeadingLevels {
  h1: WechatHeadingLevelStyle;
  h2: WechatHeadingLevelStyle;
  h3: WechatHeadingLevelStyle;
}

export const CARD_ALIGNS = ["left", "center", "right"] as const;
export type CardAlign = (typeof CARD_ALIGNS)[number];
export const GUIDE_AUTHOR_ALIGNS = ["left", "center", "right", "hidden"] as const;
export type GuideAuthorAlign = (typeof GUIDE_AUTHOR_ALIGNS)[number];

export interface IdentityCardStyle {
  enabled: boolean;
  badge: string;
  badgeAlign: CardAlign;
  title: string;
  hideTitle: boolean;
  titleAlign: CardAlign;
  subtitle: string;
  subtitleAlign: CardAlign;
  slogan: string;
  sloganAlign: CardAlign;
  avatarUrl: string;
  nickname: string;
  tag: string;
  authorAlign: CardAlign;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  titleFontSize: number;
  subtitleFontSize: number;
}

export interface TailGuideStyle {
  enabled: boolean;
  title: string;
  likeText: string;
  likeEmoji: string;
  likeHighlight: boolean;
  readText: string;
  readEmoji: string;
  readHighlight: boolean;
  starText: string;
  starEmoji: string;
  starHighlight: boolean;
  footerText: string;
  backgroundColor: string;
  textColor: string;
  authorAlign: GuideAuthorAlign;
}

export interface WechatStyle {
  themeId: string;
  fontFamily: WechatFontChoice;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  pagePadding: number;
  pageBackground: string;
  textColor: string;
  accentColor: string;
  fontWeight: number;
  letterSpacing: number;
  textIndent: boolean;
  headingTemplate: HeadingTemplate;
  headingStyle?: HeadingStyle;
  headings: WechatHeadingLevels;
  strongColor: string;
  strongHighlight: string;
  strongHighlightHeight: StrongHighlightHeight;
  strongHighlightOpacity: number;
  italicColor: string;
  deleteColor: string;
  linkColor: string;
  linkUnderline: LinkUnderline;
  unorderedListStyle: string;
  orderedListStyle: string;
  listPadding: number;
  listSpacing: number;
  quoteStyle: QuoteStyle;
  quoteBorderWidth: number;
  quoteBorderColor: string;
  quoteBackground: string;
  quoteRadius: number;
  quotePadding: number;
  quoteSpacing: number;
  codeStyle: CodeStyle;
  codeBackground: string;
  codeTextColor: string;
  codeFontSize: number;
  codeRadius: number;
  inlineCodeBackground: string;
  inlineCodeColor: string;
  showPhoneFrame: boolean;
  identityCard: IdentityCardStyle;
  tailGuide: TailGuideStyle;
}

type ThemeDefaults = Pick<
  WechatStyle,
  | "fontFamily"
  | "fontSize"
  | "lineHeight"
  | "paragraphSpacing"
  | "pagePadding"
  | "pageBackground"
  | "textColor"
  | "accentColor"
  | "headingTemplate"
  | "quoteStyle"
  | "codeStyle"
>;

export interface WechatTheme extends ThemeMeta {
  defaults: ThemeDefaults;
  palette: {
    pageBorderColor: string;
    headingColor: string;
    titleBg: string;
    titleColor: string;
    sectionBg: string;
    mutedColor: string;
    borderColor: string;
    quoteBackground: string;
    codeBackground: string;
    codeText: string;
    inlineCodeBackground: string;
    inlineCodeColor: string;
    linkColor: string;
    tableHeaderBackground: string;
  };
}

const themes: Array<
  Pick<WechatTheme, "id" | "labelKey" | "palette"> & {
    defaults: Omit<
      ThemeDefaults,
      | "fontFamily"
      | "fontSize"
      | "lineHeight"
      | "paragraphSpacing"
      | "pagePadding"
      | "headingTemplate"
      | "quoteStyle"
      | "codeStyle"
    > &
      Partial<ThemeDefaults>;
  }
> = [
  {
    id: "classic",
    labelKey: "wechat.themeClassic",
    defaults: { pageBackground: "#ffffff", textColor: "#2f2f2f", accentColor: "#6b7280" },
    palette: {
      pageBorderColor: "#e5e7eb",
      headingColor: "#111111",
      titleBg: "#1f1f1f",
      titleColor: "#ffffff",
      sectionBg: "#f3f4f6",
      mutedColor: "#6b7280",
      borderColor: "#d1d5db",
      quoteBackground: "#f7f7f8",
      codeBackground: "#f4f4f5",
      codeText: "#202020",
      inlineCodeBackground: "#f1f1f3",
      inlineCodeColor: "#3a3a3a",
      linkColor: "#374151",
      tableHeaderBackground: "#f3f4f6",
    },
  },
  {
    id: "elegant",
    labelKey: "wechat.themeElegant",
    defaults: { pageBackground: "#fdfaf5", textColor: "#3f3f3f", accentColor: "#8b572a" },
    palette: {
      pageBorderColor: "#e2d7ca",
      headingColor: "#8b572a",
      titleBg: "#8b572a",
      titleColor: "#fffaf2",
      sectionBg: "#f6ede3",
      mutedColor: "#8b7661",
      borderColor: "#d6cbbf",
      quoteBackground: "#faf6f1",
      codeBackground: "#faf6f1",
      codeText: "#3f3f3f",
      inlineCodeBackground: "#faf6f1",
      inlineCodeColor: "#8b572a",
      linkColor: "#8b572a",
      tableHeaderBackground: "#faf6f1",
    },
  },
  {
    id: "ocean",
    labelKey: "wechat.themeOcean",
    defaults: { pageBackground: "#f7fbff", textColor: "#2c3e50", accentColor: "#1565c0" },
    palette: {
      pageBorderColor: "#cfe2f6",
      headingColor: "#1565c0",
      titleBg: "#1565c0",
      titleColor: "#f4f9ff",
      sectionBg: "#eaf4ff",
      mutedColor: "#607d96",
      borderColor: "#bbdefb",
      quoteBackground: "#e3f2fd",
      codeBackground: "#e8eaf6",
      codeText: "#283593",
      inlineCodeBackground: "#e3f2fd",
      inlineCodeColor: "#1565c0",
      linkColor: "#1565c0",
      tableHeaderBackground: "#e3f2fd",
    },
  },
  {
    id: "forest",
    labelKey: "wechat.themeForest",
    defaults: { pageBackground: "#f6fbf3", textColor: "#353535", accentColor: "#2e7d32" },
    palette: {
      pageBorderColor: "#cfe4cc",
      headingColor: "#2e7d32",
      titleBg: "#2e7d32",
      titleColor: "#f5fff4",
      sectionBg: "#e9f5e6",
      mutedColor: "#647965",
      borderColor: "#c8e6c9",
      quoteBackground: "#f1f8e9",
      codeBackground: "#f1f8e9",
      codeText: "#33691e",
      inlineCodeBackground: "#e8f5e9",
      inlineCodeColor: "#2e7d32",
      linkColor: "#2e7d32",
      tableHeaderBackground: "#e8f5e9",
    },
  },
  {
    id: "rose",
    labelKey: "wechat.themeRose",
    defaults: { pageBackground: "#fff8fa", textColor: "#4a3333", accentColor: "#b5495b" },
    palette: {
      pageBorderColor: "#f2d3da",
      headingColor: "#b5495b",
      titleBg: "#b5495b",
      titleColor: "#fff7f8",
      sectionBg: "#fdebef",
      mutedColor: "#8c7074",
      borderColor: "#f5c6ce",
      quoteBackground: "#fdf2f4",
      codeBackground: "#fdf2f4",
      codeText: "#4a3333",
      inlineCodeBackground: "#fce7eb",
      inlineCodeColor: "#b5495b",
      linkColor: "#b5495b",
      tableHeaderBackground: "#fce7eb",
    },
  },
  {
    id: "dark",
    labelKey: "wechat.themeDark",
    defaults: { pageBackground: "#1a1a2e", textColor: "#d4d4d8", accentColor: "#a1a1aa" },
    palette: {
      pageBorderColor: "#2d2d44",
      headingColor: "#e4e4e7",
      titleBg: "#e4e4e7",
      titleColor: "#1a1a2e",
      sectionBg: "#232340",
      mutedColor: "#a1a1aa",
      borderColor: "#3f3f5c",
      quoteBackground: "#1f1f38",
      codeBackground: "#16162a",
      codeText: "#c8c8d0",
      inlineCodeBackground: "#232340",
      inlineCodeColor: "#c8c8d0",
      linkColor: "#93c5fd",
      tableHeaderBackground: "#232340",
    },
  },
  {
    id: "sunset",
    labelKey: "wechat.themeDeepSea",
    defaults: { pageBackground: "#08131d", textColor: "#d7e8f3", accentColor: "#22c3ee" },
    palette: {
      pageBorderColor: "#163247",
      headingColor: "#8fe7ff",
      titleBg: "#0f3b53",
      titleColor: "#ecfeff",
      sectionBg: "#0d2231",
      mutedColor: "#8aa8b8",
      borderColor: "#1f4c63",
      quoteBackground: "#0b1c29",
      codeBackground: "#07111a",
      codeText: "#cce7f2",
      inlineCodeBackground: "#123247",
      inlineCodeColor: "#7dd3fc",
      linkColor: "#67e8f9",
      tableHeaderBackground: "#0d2231",
    },
  },
];

const commonDefaults: Omit<ThemeDefaults, "pageBackground" | "textColor" | "accentColor"> = {
  fontFamily: "sans",
  fontSize: 16,
  lineHeight: 1.8,
  paragraphSpacing: 12,
  pagePadding: 24,
  headingTemplate: "classic",
  quoteStyle: "bar",
  codeStyle: "light",
};

export const WECHAT_THEMES: WechatTheme[] = themes.map((theme) => ({
  ...theme,
  defaults: { ...commonDefaults, ...theme.defaults } as ThemeDefaults,
}));

export const DEFAULT_WECHAT_THEME_ID = WECHAT_THEMES[0].id;

const LEGACY_THEME_ALIASES: Record<string, string> = {
  default: "classic",
  green: "forest",
  purple: "dark",
  amber: "sunset",
  mint: "forest",
  slate: "classic",
  minimal: "classic",
  warm: "elegant",
  tech: "ocean",
  aurora: "sunset",
  deepsea: "sunset",
};

export function getWechatTheme(id: string): WechatTheme {
  const normalized = LEGACY_THEME_ALIASES[id] ?? id;
  return WECHAT_THEMES.find((theme) => theme.id === normalized) ?? WECHAT_THEMES[0];
}

export function createDefaultIdentityCard(locale: Locale = "zh"): IdentityCardStyle {
  return {
    enabled: false,
    badge: translate(locale, "wechat.defaultIdentityBadge"),
    badgeAlign: "left",
    // 标题和副标题留空时由渲染层从正文的一级标题、首段兜底填充，见 deriveIdentityCardContent。
    title: "",
    // 卡片已经接管了标题，正文里默认不再重复一遍。
    hideTitle: true,
    titleAlign: "left",
    subtitle: "",
    subtitleAlign: "left",
    slogan: "",
    sloganAlign: "left",
    avatarUrl: "",
    nickname: "",
    tag: "",
    authorAlign: "left",
    backgroundColor: "",
    textColor: "",
    borderRadius: 16,
    titleFontSize: 28,
    subtitleFontSize: 15,
  };
}

export const DEFAULT_IDENTITY_CARD: IdentityCardStyle = createDefaultIdentityCard();

function createDefaultTailGuide(locale: Locale = "zh"): TailGuideStyle {
  return {
    enabled: false,
    title: translate(locale, "wechat.defaultTailGuideTitle"),
    likeText: translate(locale, "wechat.defaultTailGuideLike"),
    likeEmoji: "🤝",
    likeHighlight: false,
    readText: translate(locale, "wechat.defaultTailGuideRead"),
    readEmoji: "👍",
    readHighlight: false,
    starText: translate(locale, "wechat.defaultTailGuideStar"),
    starEmoji: "⭐",
    starHighlight: true,
    footerText: translate(locale, "wechat.defaultTailGuideFooter"),
    backgroundColor: "",
    textColor: "",
    authorAlign: "center",
  };
}

export function createDefaultHeadingLevel(): WechatHeadingLevelStyle {
  return {
    scale: 1,
    spacing: 1,
    weight: 700,
    align: "left",
    number: { ...DEFAULT_HEADING_NUMBER },
    background: "",
    textColor: "",
  };
}

function createDefaultHeadings(): WechatHeadingLevels {
  return {
    h1: createDefaultHeadingLevel(),
    h2: createDefaultHeadingLevel(),
    h3: createDefaultHeadingLevel(),
  };
}

export function wechatStyleFromTheme(themeId: string, locale: Locale = "zh"): WechatStyle {
  const theme = getWechatTheme(themeId);
  const d = theme.defaults;
  return {
    themeId: theme.id,
    ...d,
    fontWeight: 400,
    letterSpacing: 0.5,
    textIndent: false,
    headings: createDefaultHeadings(),
    strongColor: "",
    strongHighlight: "",
    strongHighlightHeight: "half-bottom",
    strongHighlightOpacity: 0.35,
    italicColor: "",
    deleteColor: "#999999",
    linkColor: "",
    linkUnderline: "solid",
    unorderedListStyle: "disc",
    orderedListStyle: "decimal",
    listPadding: 24,
    listSpacing: 4,
    quoteBorderWidth: 4,
    quoteBorderColor: "",
    quoteBackground: "",
    quoteRadius: 10,
    quotePadding: 14,
    quoteSpacing: 16,
    codeBackground: "",
    codeTextColor: "",
    codeFontSize: 13,
    codeRadius: 10,
    inlineCodeBackground: "",
    inlineCodeColor: "",
    showPhoneFrame: true,
    identityCard: createDefaultIdentityCard(locale),
    tailGuide: createDefaultTailGuide(locale),
  };
}

export const DEFAULT_WECHAT_STYLE: WechatStyle = wechatStyleFromTheme(DEFAULT_WECHAT_THEME_ID);

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const optionalColor = (value: unknown, fallback = "") =>
  typeof value === "string" && (value === "" || COLOR_RE.test(value)) ? value : fallback;
const color = (value: unknown, fallback: string) => optionalColor(value, fallback) || fallback;
const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.slice(0, 500) : fallback;
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

function parseIdentity(raw: unknown, fallback: IdentityCardStyle): IdentityCardStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<IdentityCardStyle>) : {};
  return {
    enabled: bool(input.enabled, fallback.enabled),
    badge: text(input.badge, fallback.badge),
    badgeAlign: pick(input.badgeAlign, CARD_ALIGNS, fallback.badgeAlign),
    title: text(input.title, fallback.title),
    hideTitle: bool(input.hideTitle, fallback.hideTitle),
    titleAlign: pick(input.titleAlign, CARD_ALIGNS, fallback.titleAlign),
    subtitle: text(input.subtitle, fallback.subtitle),
    subtitleAlign: pick(input.subtitleAlign, CARD_ALIGNS, fallback.subtitleAlign),
    slogan: text(input.slogan, fallback.slogan),
    sloganAlign: pick(input.sloganAlign, CARD_ALIGNS, fallback.sloganAlign),
    avatarUrl: text(input.avatarUrl, fallback.avatarUrl),
    nickname: text(input.nickname, fallback.nickname),
    tag: text(input.tag, fallback.tag),
    authorAlign: pick(input.authorAlign, CARD_ALIGNS, fallback.authorAlign),
    backgroundColor: optionalColor(input.backgroundColor, fallback.backgroundColor),
    textColor: optionalColor(input.textColor, fallback.textColor),
    borderRadius: num(input.borderRadius, fallback.borderRadius, 0, 32),
    titleFontSize: num(input.titleFontSize, fallback.titleFontSize, 20, 36),
    subtitleFontSize: num(input.subtitleFontSize, fallback.subtitleFontSize, 12, 20),
  };
}

function parseTailGuide(raw: unknown, fallback: TailGuideStyle): TailGuideStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<TailGuideStyle>) : {};
  return {
    enabled: bool(input.enabled, fallback.enabled),
    title: text(input.title, fallback.title),
    likeText: text(input.likeText, fallback.likeText),
    likeEmoji: text(input.likeEmoji, fallback.likeEmoji),
    likeHighlight: bool(input.likeHighlight, fallback.likeHighlight),
    readText: text(input.readText, fallback.readText),
    readEmoji: text(input.readEmoji, fallback.readEmoji),
    readHighlight: bool(input.readHighlight, fallback.readHighlight),
    starText: text(input.starText, fallback.starText),
    starEmoji: text(input.starEmoji, fallback.starEmoji),
    starHighlight: bool(input.starHighlight, fallback.starHighlight),
    footerText: text(input.footerText, fallback.footerText),
    backgroundColor: optionalColor(input.backgroundColor, fallback.backgroundColor),
    textColor: optionalColor(input.textColor, fallback.textColor),
    authorAlign: pick(input.authorAlign, GUIDE_AUTHOR_ALIGNS, fallback.authorAlign),
  };
}

function parseHeadingNumber(
  raw: unknown,
  legacyEnabled: unknown,
  fallback: HeadingNumberStyle,
): HeadingNumberStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<HeadingNumberStyle>) : {};
  return {
    enabled: bool(input.enabled, bool(legacyEnabled, fallback.enabled)),
    sizeMultiplier: num(input.sizeMultiplier, fallback.sizeMultiplier, 1, 5),
    position: pick(input.position, HEADING_NUMBER_POSITIONS, fallback.position),
    color: optionalColor(input.color, fallback.color),
    opacity: num(input.opacity, fallback.opacity, 0.02, 1),
    labelText: text(input.labelText, fallback.labelText),
    labelPosition: pick(
      input.labelPosition,
      HEADING_NUMBER_LABEL_POSITIONS,
      fallback.labelPosition,
    ),
    labelSizeMultiplier: num(input.labelSizeMultiplier, fallback.labelSizeMultiplier, 0.4, 1.5),
    labelColor: optionalColor(input.labelColor, fallback.labelColor),
    labelOpacity: num(input.labelOpacity, fallback.labelOpacity, 0.02, 1),
  };
}

/** 兼容旧版本每个层级共享同一组全局字段的情况，作为该层级未单独配置时的兜底值。 */
function legacyHeadingLevel(
  legacy: Record<string, unknown>,
  fallback: WechatHeadingLevelStyle,
): WechatHeadingLevelStyle {
  return {
    scale: num(legacy.headingScale, fallback.scale, 0.75, 1.5),
    spacing: num(legacy.headingSpacingScale, fallback.spacing, 0.5, 2),
    weight: num(legacy.headingWeight, fallback.weight, 400, 900),
    align: pick(legacy.headingAlign, HEADING_ALIGNS, fallback.align),
    number: fallback.number,
    background: fallback.background,
    textColor: fallback.textColor,
  };
}

function parseHeadingLevel(
  raw: unknown,
  fallback: WechatHeadingLevelStyle,
): WechatHeadingLevelStyle {
  const input =
    raw && typeof raw === "object"
      ? (raw as Partial<Record<keyof WechatHeadingLevelStyle, unknown>>)
      : {};
  return {
    scale: num(input.scale, fallback.scale, 0.75, 1.5),
    spacing: num(input.spacing, fallback.spacing, 0.5, 2),
    weight: num(input.weight, fallback.weight, 400, 900),
    align: pick(input.align, HEADING_ALIGNS, fallback.align),
    number: parseHeadingNumber(input.number, undefined, fallback.number),
    background: optionalColor(input.background, fallback.background),
    textColor: optionalColor(input.textColor, fallback.textColor),
  };
}

function parseHeadings(
  raw: Record<string, unknown>,
  fallback: WechatHeadingLevels,
): WechatHeadingLevels {
  const headingsInput =
    raw.headings && typeof raw.headings === "object"
      ? (raw.headings as Partial<Record<keyof WechatHeadingLevels, unknown>>)
      : null;
  return {
    h1: parseHeadingLevel(headingsInput?.h1, legacyHeadingLevel(raw, fallback.h1)),
    h2: parseHeadingLevel(headingsInput?.h2, {
      ...legacyHeadingLevel(raw, fallback.h2),
      // 旧版本只支持给二级标题编号，迁移时把它落到 h2.number 上。
      number: parseHeadingNumber(raw.headingNumber, raw.h2Numbering, fallback.h2.number),
    }),
    h3: parseHeadingLevel(headingsInput?.h3, legacyHeadingLevel(raw, fallback.h3)),
  };
}

export function parseWechatStyle(raw: unknown): WechatStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<WechatStyle> & { headingStyle?: unknown };
  const legacyRaw = raw as Record<string, unknown>;
  const rawFontFamily = legacyRaw.fontFamily;
  const theme = getWechatTheme(typeof input.themeId === "string" ? input.themeId : "");
  const d = wechatStyleFromTheme(theme.id);
  const legacyHeading: Record<string, HeadingTemplate> = {
    plain: "minimal",
    bar: "accent",
    underline: "underline",
    badge: "highlight",
  };
  return {
    ...d,
    themeId: theme.id,
    fontFamily:
      rawFontFamily === "round"
        ? "rounded"
        : isWechatFontChoice(rawFontFamily)
          ? rawFontFamily
          : d.fontFamily,
    fontSize: num(input.fontSize, d.fontSize, 12, 22),
    lineHeight: num(input.lineHeight, d.lineHeight, 1.2, 2.6),
    paragraphSpacing: num(input.paragraphSpacing, d.paragraphSpacing, 0, 48),
    pagePadding: num(input.pagePadding, d.pagePadding, 0, 64),
    pageBackground: color(input.pageBackground, d.pageBackground),
    textColor: color(input.textColor, d.textColor),
    accentColor: color(input.accentColor, d.accentColor),
    fontWeight: num(input.fontWeight, d.fontWeight, 200, 900),
    letterSpacing: num(input.letterSpacing, d.letterSpacing, 0, 3),
    textIndent: bool(input.textIndent, d.textIndent),
    headingTemplate: pick(
      input.headingTemplate ?? legacyHeading[String(input.headingStyle)],
      HEADING_TEMPLATES,
      d.headingTemplate,
    ),
    headings: parseHeadings(legacyRaw, d.headings),
    strongColor: optionalColor(input.strongColor, d.strongColor),
    strongHighlight: optionalColor(input.strongHighlight, d.strongHighlight),
    strongHighlightHeight: pick(
      input.strongHighlightHeight,
      STRONG_HIGHLIGHT_HEIGHTS,
      d.strongHighlightHeight,
    ),
    strongHighlightOpacity: num(input.strongHighlightOpacity, d.strongHighlightOpacity, 0, 1),
    italicColor: optionalColor(input.italicColor, d.italicColor),
    deleteColor: color(input.deleteColor, d.deleteColor),
    linkColor: optionalColor(input.linkColor, d.linkColor),
    linkUnderline: pick(input.linkUnderline, LINK_UNDERLINES, d.linkUnderline),
    unorderedListStyle: text(input.unorderedListStyle, d.unorderedListStyle),
    orderedListStyle: text(input.orderedListStyle, d.orderedListStyle),
    listPadding: num(input.listPadding, d.listPadding, 12, 56),
    listSpacing: num(input.listSpacing, d.listSpacing, 0, 16),
    quoteStyle: pick(input.quoteStyle, QUOTE_STYLES, d.quoteStyle),
    quoteBorderWidth: num(input.quoteBorderWidth, d.quoteBorderWidth, 0, 12),
    quoteBorderColor: optionalColor(input.quoteBorderColor, d.quoteBorderColor),
    quoteBackground: optionalColor(input.quoteBackground, d.quoteBackground),
    quoteRadius: num(input.quoteRadius, d.quoteRadius, 0, 32),
    quotePadding: num(input.quotePadding, d.quotePadding, 0, 32),
    quoteSpacing: num(input.quoteSpacing, d.quoteSpacing, 0, 48),
    codeStyle: pick(input.codeStyle, CODE_STYLES, d.codeStyle),
    codeBackground: optionalColor(input.codeBackground, d.codeBackground),
    codeTextColor: optionalColor(input.codeTextColor, d.codeTextColor),
    codeFontSize: num(input.codeFontSize, d.codeFontSize, 10, 18),
    codeRadius: num(input.codeRadius, d.codeRadius, 0, 24),
    inlineCodeBackground: optionalColor(input.inlineCodeBackground, d.inlineCodeBackground),
    inlineCodeColor: optionalColor(input.inlineCodeColor, d.inlineCodeColor),
    showPhoneFrame: bool(input.showPhoneFrame, d.showPhoneFrame),
    identityCard: parseIdentity(input.identityCard, d.identityCard),
    tailGuide: parseTailGuide(input.tailGuide, d.tailGuide),
  };
}
