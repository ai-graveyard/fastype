import {
  DEFAULT_HEADING_NUMBER,
  HEADING_NUMBER_LABEL_POSITIONS,
  HEADING_NUMBER_POSITIONS,
  isFontChoice,
  type FontChoice,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
  type HeadingNumberStyle,
  type ThemeMeta,
} from "./types";
import { XHS_IDENTIFIER_BADGES, type XhsIdentifierBadge } from "@/components/ui/identifier-badges";

export {
  HEADING_NUMBER_LABEL_POSITIONS,
  HEADING_NUMBER_POSITIONS,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
  type HeadingNumberStyle,
};

/**
 * 小红书卡片主题。
 *
 * 所有尺寸都基于 1080×1440 的逻辑画布（3:4）。预览用 CSS transform 缩放同一份 DOM，
 * 导出时按原始尺寸渲染，因此预览和导出天然一致（PRD FT-XHS-005 / 12.3）。
 */
export const XHS_CANVAS_WIDTH = 1080;
export const XHS_ASPECT = 4 / 3;
export const XHS_CANVAS_HEIGHT = Math.round(XHS_CANVAS_WIDTH * XHS_ASPECT); // 1440

export const XHS_ASPECT_RATIOS = [
  { value: "3:4", label: "3:4", width: 1080, height: 1440 },
  { value: "4:5", label: "4:5", width: 1080, height: 1350 },
  { value: "9:16", label: "9:16", width: 1080, height: 1920 },
  { value: "1:1", label: "1:1", width: 1080, height: 1080 },
  { value: "4:3", label: "4:3", width: 1440, height: 1080 },
  { value: "5:4", label: "5:4", width: 1350, height: 1080 },
  { value: "16:9", label: "16:9", width: 1920, height: 1080 },
] as const;

export type XhsAspectRatio = (typeof XHS_ASPECT_RATIOS)[number]["value"] | "custom";

/** 与 LovType 一致的页脚序号缩放范围；基础字号为 14px。 */
export const XHS_PAGE_NUMBER_SCALE_RANGE = {
  min: 1,
  max: 5,
  step: 0.1,
  default: 2.5,
} as const;

export interface XhsExportSize {
  id: string;
  label: string;
  /** 相对逻辑画布的像素倍率。 */
  scale: number;
}

export const XHS_HEADING_TEMPLATES = [
  "classic",
  "highlight",
  "underline",
  "accent",
  "block",
  "elegant",
  "dot",
  "corner",
] as const;

export type XhsHeadingTemplate = (typeof XHS_HEADING_TEMPLATES)[number];
export type XhsTextAlign = "left" | "center" | "right";
export type XhsIdentifierPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type XhsLinkUnderline = "solid" | "dashed" | "none";
export type XhsUnorderedListStyle = "disc" | "circle" | "square";
export type XhsOrderedListStyle = "decimal" | "lower-alpha" | "lower-roman" | "cjk-ideographic";
export const XHS_COVER_GRAPHIC_ICONS = [
  "sparkles",
  "star",
  "heart",
  "flower",
  "sun",
  "zap",
  "cloud",
  "quote",
  "arrow-up-right",
  "asterisk",
  "circle",
  "triangle",
] as const;
export type XhsCoverGraphicIcon = (typeof XHS_COVER_GRAPHIC_ICONS)[number];

export interface XhsCoverGraphic {
  id: string;
  icon: XhsCoverGraphicIcon;
  /** 图形中心点相对封面宽高的百分比。 */
  x: number;
  y: number;
  /** 逻辑画布中的图形尺寸（px）。 */
  size: number;
  rotation: number;
  color: string;
  opacity: number;
  strokeWidth: number;
}

export const XHS_COVER_GRAPHICS_LIMIT = 12;

export interface XhsHeadingLevelStyle {
  scale: number;
  spacing: number;
  weight: number;
  align: XhsTextAlign;
  number: HeadingNumberStyle;
  /** 留空时不额外着色，跟随标题模板的默认样式。 */
  background: string;
  textColor: string;
}

export interface XhsHeadingLevels {
  h1: XhsHeadingLevelStyle;
  h2: XhsHeadingLevelStyle;
  h3: XhsHeadingLevelStyle;
}

export interface XhsCoverStyle {
  enabled: boolean;
  /** 留空时自动使用正文第一个 H1。 */
  text: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  align: XhsTextAlign;
  background: string;
  textColor: string;
  hideBodyTitle: boolean;
  /** 只保存用户主动添加的装饰图形；默认封面不自动生成任何图形。 */
  graphics: XhsCoverGraphic[];
}

/** 导出卡片上的创作者标识，复用全局用户资料中的头像、昵称和签名。 */
export interface XhsIdentifierStyle {
  enabled: boolean;
  /** 是否也在封面中展示；默认只展示在正文卡片。 */
  showOnCover: boolean;
  position: XhsIdentifierPosition;
  scale: number;
  showDate: boolean;
  avatarBorder: boolean;
  /** 显示在昵称右侧的 LoveType 风格小徽章。 */
  badge: XhsIdentifierBadge;
  /** 关闭时保留所选款式，但不在昵称右侧渲染。 */
  badgeEnabled: boolean;
  /** 留空时沿用昵称颜色。 */
  badgeColor: string;
  /** 相对昵称字号的缩放倍数。 */
  badgeScale: number;
  /** 线条粗细，对应图标的 strokeWidth。 */
  badgeStrokeWidth: number;
}

/** 徽章大小相对昵称字号的缩放范围。 */
export const XHS_IDENTIFIER_BADGE_SCALE_RANGE = {
  min: 0.5,
  max: 2,
  step: 0.1,
  default: 1,
} as const;

/** 徽章线条粗细范围，对应 lucide 图标默认的 strokeWidth（2）。 */
export const XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE = {
  min: 1,
  max: 3,
  step: 0.25,
  default: 2,
} as const;

export interface XhsElementStyle {
  strongColor: string;
  strongHighlight: string;
  italicColor: string;
  strikeColor: string;
  linkColor: string;
  linkUnderline: XhsLinkUnderline;
  unorderedListStyle: XhsUnorderedListStyle;
  orderedListStyle: XhsOrderedListStyle;
  listIndent: number;
  listSpacing: number;
  quoteBackground: string;
  quoteBorderColor: string;
  quoteBorderWidth: number;
  quoteRadius: number;
  quotePadding: number;
  codeBackground: string;
  codeColor: string;
  codeFontSize: number;
  codeRadius: number;
  inlineCodeBackground: string;
  inlineCodeColor: string;
}

export interface XhsQrCodeStyle {
  enabled: boolean;
  /** 是否也在封面中展示；默认只展示在正文卡片。 */
  showOnCover: boolean;
  url: string;
  position: XhsIdentifierPosition;
  scale: number;
}

export const DEFAULT_XHS_HEADINGS: XhsHeadingLevels = {
  h1: {
    scale: 2,
    spacing: 1.6,
    weight: 800,
    align: "left",
    number: { ...DEFAULT_HEADING_NUMBER },
    background: "",
    textColor: "",
  },
  h2: {
    scale: 1.4,
    spacing: 1.2,
    weight: 750,
    align: "left",
    number: { ...DEFAULT_HEADING_NUMBER },
    background: "",
    textColor: "",
  },
  h3: {
    scale: 1.2,
    spacing: 1,
    weight: 700,
    align: "left",
    number: { ...DEFAULT_HEADING_NUMBER },
    background: "",
    textColor: "",
  },
};

export const DEFAULT_XHS_COVER: XhsCoverStyle = {
  enabled: false,
  text: "",
  fontSize: 150,
  fontWeight: 900,
  lineHeight: 1.2,
  align: "center",
  background: "",
  textColor: "",
  hideBodyTitle: false,
  graphics: [],
};

export const DEFAULT_XHS_IDENTIFIER: XhsIdentifierStyle = {
  enabled: true,
  showOnCover: false,
  position: "top-left",
  scale: 2,
  showDate: true,
  avatarBorder: false,
  badge: "wand-sparkles",
  badgeEnabled: false,
  badgeColor: "",
  badgeScale: XHS_IDENTIFIER_BADGE_SCALE_RANGE.default,
  badgeStrokeWidth: XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.default,
};

export const DEFAULT_XHS_QR_CODE: XhsQrCodeStyle = {
  enabled: false,
  showOnCover: false,
  url: "https://www.lovtype.com",
  position: "bottom-right",
  scale: 1,
};

export const XHS_EXPORT_SIZES: XhsExportSize[] = [
  { id: "1080", label: "1080 × 1440", scale: 1 },
  { id: "1242", label: "1242 × 1656", scale: 1.15 },
  { id: "1620", label: "1620 × 2160", scale: 1.5 },
];

/** 正文卡片一级标题的自定义文字上限，与封面文字一致。 */
export const XHS_BODY_TITLE_MAX_LENGTH = 120;

export interface XhsStyle {
  themeId: string;
  aspectRatio: XhsAspectRatio;
  customWidth: number;
  customHeight: number;
  fontFamily: FontChoice;
  /** 逻辑画布中的正文字号（px）。 */
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  textIndent: boolean;
  /** 以正文字号为基准的段后间距倍率。 */
  paragraphSpacing: number;
  /** 卡片内容边距（px）。 */
  padding: number;
  background: string;
  textColor: string;
  accentColor: string;
  /** 每张正文卡片底部页码的水平位置。 */
  pageNumberAlign: XhsTextAlign;
  showPageNumber: boolean;
  /** 是否让封面显示页码并计入页码总数。 */
  showPageNumberOnCover: boolean;
  /** 页码相对 14px 基础字号的缩放倍数。 */
  pageNumberScale: number;
  pageNumberGap: number;
  headingTemplate: XhsHeadingTemplate;
  headings: XhsHeadingLevels;
  /**
   * 正文卡片一级标题的自定义文字，留空时沿用 Markdown 正文里的第一个 H1。
   * 不写回 Markdown 原文，仅影响导出图片上的显示（FT-XHS-BODY-TITLE）。
   */
  bodyTitleOverride: string;
  cover: XhsCoverStyle;
  identifier: XhsIdentifierStyle;
  elements: XhsElementStyle;
  qrCode: XhsQrCodeStyle;
  exportSizeId: string;
}

export interface XhsTheme extends ThemeMeta {
  defaults: Omit<
    XhsStyle,
    | "themeId"
    | "aspectRatio"
    | "customWidth"
    | "customHeight"
    | "exportSizeId"
    | "headingTemplate"
    | "headings"
    | "bodyTitleOverride"
    | "cover"
    | "identifier"
    | "elements"
    | "qrCode"
  >;
  /** 由主题决定、不开放给用户直接调的次级颜色。 */
  derived: {
    mutedColor: string;
    surface: string;
    borderColor: string;
    codeBackground: string;
    codeColor: string;
    tableHeaderBackground: string;
    strongColor: string;
    italicColor: string;
    linkColor: string;
    quoteBorderColor: string;
    quoteRadius: number;
    quoteItalic: boolean;
    codeBorderColor: string;
    codeRadius: number;
    inlineCodeBackground: string;
    inlineCodeColor: string;
    hrColor: string;
    imageRadius: number;
  };
  /** 与 LovType 主题选择器一致的缩略卡片色板。 */
  preview: {
    pageBackground: string;
    pageBorderColor: string;
    titleBackground: string;
    sectionBackground: string;
  };
}

const SHARED_TYPOGRAPHY_DEFAULTS = {
  fontFamily: "sans" as const,
  fontSize: 34,
  fontWeight: 400,
  letterSpacing: 0.5,
  lineHeight: 1.85,
  textIndent: false,
  paragraphSpacing: 0.72,
  padding: 84,
  showPageNumber: true,
  showPageNumberOnCover: false,
  pageNumberAlign: "center" as const,
  pageNumberScale: XHS_PAGE_NUMBER_SCALE_RANGE.default,
  pageNumberGap: 4,
};

/** LovType 内置小红书主题，颜色与其 MARKDOWN_THEMES 和元素默认值逐项一致。 */
export const XHS_THEMES: XhsTheme[] = [
  {
    id: "classic",
    labelKey: "xhs.themeClassic",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#3b82f6",
    },
    derived: {
      mutedColor: "#6b7280",
      surface: "#f9fafb",
      borderColor: "#d1d5db",
      codeBackground: "#f6f8fa",
      codeColor: "#24292f",
      tableHeaderBackground: "#f3f4f6",
      strongColor: "#1a1a1a",
      italicColor: "#1a1a1a",
      linkColor: "#2563eb",
      quoteBorderColor: "#d1d5db",
      quoteRadius: 0,
      quoteItalic: false,
      codeBorderColor: "#e5e7eb",
      codeRadius: 6,
      inlineCodeBackground: "rgba(175, 184, 193, 0.2)",
      inlineCodeColor: "#24292f",
      hrColor: "#e5e7eb",
      imageRadius: 6,
    },
    preview: {
      pageBackground: "#ffffff",
      pageBorderColor: "#e5e7eb",
      titleBackground: "#1f1f1f",
      sectionBackground: "#f3f4f6",
    },
  },
  {
    id: "elegant",
    labelKey: "xhs.themeElegant",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#faf8f5",
      textColor: "#3d3929",
      accentColor: "#c58b54",
    },
    derived: {
      mutedColor: "#6b5e3e",
      surface: "#f5f0e8",
      borderColor: "#d4c5a9",
      codeBackground: "#f0ebe1",
      codeColor: "#3d3929",
      tableHeaderBackground: "#efe8da",
      strongColor: "#3d3929",
      italicColor: "#3d3929",
      linkColor: "#8b6914",
      quoteBorderColor: "#c9a84c",
      quoteRadius: 0,
      quoteItalic: true,
      codeBorderColor: "#d4c5a9",
      codeRadius: 6,
      inlineCodeBackground: "rgba(180, 160, 120, 0.15)",
      inlineCodeColor: "#5c4b1f",
      hrColor: "#c9a84c",
      imageRadius: 6,
    },
    preview: {
      pageBackground: "#fdfaf5",
      pageBorderColor: "#e2d7ca",
      titleBackground: "#8b572a",
      sectionBackground: "#f6ede3",
    },
  },
  {
    id: "ocean",
    labelKey: "xhs.themeOcean",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#f0f6ff",
      textColor: "#1e3a5f",
      accentColor: "#38bdf8",
    },
    derived: {
      mutedColor: "#1e4f8a",
      surface: "#e0edff",
      borderColor: "#bdd4f0",
      codeBackground: "#e0edff",
      codeColor: "#1e3a5f",
      tableHeaderBackground: "#dbe8f9",
      strongColor: "#0a2540",
      italicColor: "#1e4f8a",
      linkColor: "#2563eb",
      quoteBorderColor: "#60a5fa",
      quoteRadius: 6,
      quoteItalic: false,
      codeBorderColor: "#bdd4f0",
      codeRadius: 6,
      inlineCodeBackground: "rgba(37, 99, 235, 0.1)",
      inlineCodeColor: "#1d4ed8",
      hrColor: "#60a5fa",
      imageRadius: 8,
    },
    preview: {
      pageBackground: "#f7fbff",
      pageBorderColor: "#cfe2f6",
      titleBackground: "#1565c0",
      sectionBackground: "#eaf4ff",
    },
  },
  {
    id: "forest",
    labelKey: "xhs.themeForest",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#f1f7f1",
      textColor: "#2d3b2d",
      accentColor: "#65a30d",
    },
    derived: {
      mutedColor: "#33691e",
      surface: "#e4f0e4",
      borderColor: "#c3d9c3",
      codeBackground: "#e4f0e4",
      codeColor: "#2d3b2d",
      tableHeaderBackground: "#dceadc",
      strongColor: "#1a2e1a",
      italicColor: "#33691e",
      linkColor: "#2e7d32",
      quoteBorderColor: "#81c784",
      quoteRadius: 6,
      quoteItalic: true,
      codeBorderColor: "#c3d9c3",
      codeRadius: 6,
      inlineCodeBackground: "rgba(46, 125, 50, 0.1)",
      inlineCodeColor: "#1b5e20",
      hrColor: "#81c784",
      imageRadius: 6,
    },
    preview: {
      pageBackground: "#f6fbf3",
      pageBorderColor: "#cfe4cc",
      titleBackground: "#2e7d32",
      sectionBackground: "#e9f5e6",
    },
  },
  {
    id: "rose",
    labelKey: "xhs.themeRose",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#fdf2f4",
      textColor: "#4a2c36",
      accentColor: "#e95a87",
    },
    derived: {
      mutedColor: "#6d2b3e",
      surface: "#fce4ec",
      borderColor: "#f0c4d0",
      codeBackground: "#fce4ec",
      codeColor: "#4a2c36",
      tableHeaderBackground: "#f8d7de",
      strongColor: "#880e4f",
      italicColor: "#ad1457",
      linkColor: "#c2185b",
      quoteBorderColor: "#f06292",
      quoteRadius: 8,
      quoteItalic: false,
      codeBorderColor: "#f0c4d0",
      codeRadius: 8,
      inlineCodeBackground: "rgba(194, 24, 91, 0.08)",
      inlineCodeColor: "#ad1457",
      hrColor: "#f06292",
      imageRadius: 8,
    },
    preview: {
      pageBackground: "#fff8fa",
      pageBorderColor: "#f2d3da",
      titleBackground: "#b5495b",
      sectionBackground: "#fdebef",
    },
  },
  {
    id: "dark",
    labelKey: "xhs.themeDark",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#1a1b26",
      textColor: "#c0caf5",
      accentColor: "#9aa5ff",
    },
    derived: {
      mutedColor: "#9aa5ce",
      surface: "#24283b",
      borderColor: "#3b3d57",
      codeBackground: "#24283b",
      codeColor: "#c0caf5",
      tableHeaderBackground: "#24283b",
      strongColor: "#c0caf5",
      italicColor: "#c0caf5",
      linkColor: "#7aa2f7",
      quoteBorderColor: "#565f89",
      quoteRadius: 0,
      quoteItalic: false,
      codeBorderColor: "#3b3d57",
      codeRadius: 6,
      inlineCodeBackground: "rgba(86, 95, 137, 0.3)",
      inlineCodeColor: "#bb9af7",
      hrColor: "#3b3d57",
      imageRadius: 6,
    },
    preview: {
      pageBackground: "#202333",
      pageBorderColor: "#3a405c",
      titleBackground: "#6f7bf7",
      sectionBackground: "#2a2e42",
    },
  },
  {
    id: "deepsea",
    labelKey: "xhs.themeDeepSea",
    defaults: {
      ...SHARED_TYPOGRAPHY_DEFAULTS,
      background: "#08131d",
      textColor: "#d7e8f3",
      accentColor: "#22c3ee",
    },
    derived: {
      mutedColor: "#d7e8f3",
      surface: "#0b1c29",
      borderColor: "#1f4c63",
      codeBackground: "#07111a",
      codeColor: "#cce7f2",
      tableHeaderBackground: "#0d2231",
      strongColor: "#8fe7ff",
      italicColor: "#67e8f9",
      linkColor: "#67e8f9",
      quoteBorderColor: "#22c3ee",
      quoteRadius: 8,
      quoteItalic: false,
      codeBorderColor: "#1f4c63",
      codeRadius: 8,
      inlineCodeBackground: "rgba(18, 50, 71, 0.9)",
      inlineCodeColor: "#7dd3fc",
      hrColor: "#22c3ee",
      imageRadius: 8,
    },
    preview: {
      pageBackground: "#08131d",
      pageBorderColor: "#163247",
      titleBackground: "#0f3b53",
      sectionBackground: "#0d2231",
    },
  },
];

export const DEFAULT_XHS_THEME_ID = XHS_THEMES[0].id;

const LEGACY_XHS_THEME_ALIASES: Record<string, string> = {
  simple: "classic",
  bold: "dark",
  soft: "rose",
  ink: "elegant",
  cream: "forest",
  warm: "elegant",
  sunset: "deepsea",
};

export function getXhsTheme(id: string): XhsTheme {
  const normalized = LEGACY_XHS_THEME_ALIASES[id] ?? id;
  return XHS_THEMES.find((theme) => theme.id === normalized) ?? XHS_THEMES[0];
}

function xhsElementsFromTheme(theme: XhsTheme): XhsElementStyle {
  return {
    strongColor: theme.derived.strongColor,
    strongHighlight: "",
    italicColor: theme.derived.italicColor,
    strikeColor: theme.derived.mutedColor,
    linkColor: theme.derived.linkColor,
    linkUnderline: "solid",
    unorderedListStyle: "disc",
    orderedListStyle: "decimal",
    listIndent: 40,
    listSpacing: 10,
    quoteBackground: theme.derived.surface,
    quoteBorderColor: theme.derived.quoteBorderColor,
    quoteBorderWidth: 5,
    quoteRadius: theme.derived.quoteRadius,
    quotePadding: 20,
    codeBackground: theme.derived.codeBackground,
    codeColor: theme.derived.codeColor,
    codeFontSize: 27,
    codeRadius: theme.derived.codeRadius,
    inlineCodeBackground: theme.derived.inlineCodeBackground,
    inlineCodeColor: theme.derived.inlineCodeColor,
  };
}

export function xhsStyleFromTheme(themeId: string, exportSizeId?: string): XhsStyle {
  const theme = getXhsTheme(themeId);
  return {
    themeId: theme.id,
    aspectRatio: "3:4",
    customWidth: XHS_CANVAS_WIDTH,
    customHeight: XHS_CANVAS_HEIGHT,
    ...theme.defaults,
    headingTemplate: "classic",
    headings: DEFAULT_XHS_HEADINGS,
    bodyTitleOverride: "",
    cover: DEFAULT_XHS_COVER,
    identifier: DEFAULT_XHS_IDENTIFIER,
    elements: xhsElementsFromTheme(theme),
    qrCode: DEFAULT_XHS_QR_CODE,
    exportSizeId: exportSizeId ?? XHS_EXPORT_SIZES[0].id,
  };
}

export const DEFAULT_XHS_STYLE: XhsStyle = xhsStyleFromTheme(DEFAULT_XHS_THEME_ID);

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && COLOR_RE.test(value) ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isAlign(value: unknown): value is XhsTextAlign {
  return value === "left" || value === "center" || value === "right";
}

function isAspectRatio(value: unknown): value is XhsAspectRatio {
  return value === "custom" || XHS_ASPECT_RATIOS.some((ratio) => ratio.value === value);
}

function optionalColor(value: unknown, fallback: string): string {
  return typeof value === "string" && (value === "" || COLOR_RE.test(value)) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 500) : fallback;
}

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function parseHeadingNumber(raw: unknown, fallback: HeadingNumberStyle): HeadingNumberStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<HeadingNumberStyle>) : {};
  return {
    enabled: bool(input.enabled, fallback.enabled),
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

function parseHeadingLevel(raw: unknown, fallback: XhsHeadingLevelStyle): XhsHeadingLevelStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsHeadingLevelStyle>) : {};
  return {
    scale: num(input.scale, fallback.scale, 0.7, 2.4),
    spacing: num(input.spacing, fallback.spacing, 0.4, 2.2),
    weight: num(input.weight, fallback.weight, 400, 900),
    align: isAlign(input.align) ? input.align : fallback.align,
    number: parseHeadingNumber(input.number, fallback.number),
    background: optionalColor(input.background, fallback.background),
    textColor: optionalColor(input.textColor, fallback.textColor),
  };
}

function parseHeadings(raw: unknown): XhsHeadingLevels {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsHeadingLevels>) : {};
  return {
    h1: parseHeadingLevel(input.h1, DEFAULT_XHS_HEADINGS.h1),
    h2: parseHeadingLevel(input.h2, DEFAULT_XHS_HEADINGS.h2),
    h3: parseHeadingLevel(input.h3, DEFAULT_XHS_HEADINGS.h3),
  };
}

function parseCover(raw: unknown): XhsCoverStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsCoverStyle>) : {};
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_XHS_COVER.enabled,
    text: typeof input.text === "string" ? input.text.slice(0, 120) : DEFAULT_XHS_COVER.text,
    fontSize: num(input.fontSize, DEFAULT_XHS_COVER.fontSize, 48, 280),
    fontWeight: num(input.fontWeight, DEFAULT_XHS_COVER.fontWeight, 400, 900),
    lineHeight: num(input.lineHeight, DEFAULT_XHS_COVER.lineHeight, 1, 1.8),
    align: isAlign(input.align) ? input.align : DEFAULT_XHS_COVER.align,
    background:
      input.background === "" ? "" : color(input.background, DEFAULT_XHS_COVER.background),
    textColor: input.textColor === "" ? "" : color(input.textColor, DEFAULT_XHS_COVER.textColor),
    hideBodyTitle:
      typeof input.hideBodyTitle === "boolean"
        ? input.hideBodyTitle
        : DEFAULT_XHS_COVER.hideBodyTitle,
    graphics: parseCoverGraphics(input.graphics),
  };
}

function parseCoverGraphics(raw: unknown): XhsCoverGraphic[] {
  if (!Array.isArray(raw)) return [];
  const usedIds = new Set<string>();

  return raw.slice(0, XHS_COVER_GRAPHICS_LIMIT).flatMap((candidate, index): XhsCoverGraphic[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const input = candidate as Partial<XhsCoverGraphic>;
    if (!XHS_COVER_GRAPHIC_ICONS.includes(input.icon as XhsCoverGraphicIcon)) return [];

    const rawId =
      typeof input.id === "string" && input.id.trim()
        ? input.id.trim().slice(0, 80)
        : `cover-graphic-${index + 1}`;
    let id = rawId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${rawId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return [
      {
        id,
        icon: input.icon as XhsCoverGraphicIcon,
        x: num(input.x, 50, 0, 100),
        y: num(input.y, 50, 0, 100),
        size: num(input.size, 160, 48, 360),
        rotation: num(input.rotation, 0, -180, 180),
        color: color(input.color, "#ffffff"),
        opacity: num(input.opacity, 0.85, 0.1, 1),
        strokeWidth: num(input.strokeWidth, 2, 1, 5),
      },
    ];
  });
}

function isIdentifierPosition(value: unknown): value is XhsIdentifierPosition {
  return (
    value === "top-left" ||
    value === "top-right" ||
    value === "bottom-left" ||
    value === "bottom-right"
  );
}

function parseIdentifier(raw: unknown): XhsIdentifierStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsIdentifierStyle>) : {};
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_XHS_IDENTIFIER.enabled,
    showOnCover:
      typeof input.showOnCover === "boolean"
        ? input.showOnCover
        : DEFAULT_XHS_IDENTIFIER.showOnCover,
    position: isIdentifierPosition(input.position)
      ? input.position
      : DEFAULT_XHS_IDENTIFIER.position,
    scale: num(input.scale, DEFAULT_XHS_IDENTIFIER.scale, 0.5, 4),
    showDate:
      typeof input.showDate === "boolean" ? input.showDate : DEFAULT_XHS_IDENTIFIER.showDate,
    avatarBorder:
      typeof input.avatarBorder === "boolean"
        ? input.avatarBorder
        : DEFAULT_XHS_IDENTIFIER.avatarBorder,
    badge: XHS_IDENTIFIER_BADGES.includes(input.badge as XhsIdentifierBadge)
      ? (input.badge as XhsIdentifierBadge)
      : DEFAULT_XHS_IDENTIFIER.badge,
    badgeEnabled:
      typeof input.badgeEnabled === "boolean"
        ? input.badgeEnabled
        : DEFAULT_XHS_IDENTIFIER.badgeEnabled,
    badgeColor: input.badgeColor === "" ? "" : color(input.badgeColor, ""),
    badgeScale: num(
      input.badgeScale,
      DEFAULT_XHS_IDENTIFIER.badgeScale,
      XHS_IDENTIFIER_BADGE_SCALE_RANGE.min,
      XHS_IDENTIFIER_BADGE_SCALE_RANGE.max,
    ),
    badgeStrokeWidth: num(
      input.badgeStrokeWidth,
      DEFAULT_XHS_IDENTIFIER.badgeStrokeWidth,
      XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.min,
      XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.max,
    ),
  };
}

function parseElements(raw: unknown, fallback: XhsElementStyle): XhsElementStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsElementStyle>) : {};
  const unorderedListStyle =
    input.unorderedListStyle === "disc" ||
    input.unorderedListStyle === "circle" ||
    input.unorderedListStyle === "square"
      ? input.unorderedListStyle
      : fallback.unorderedListStyle;
  const orderedListStyle =
    input.orderedListStyle === "decimal" ||
    input.orderedListStyle === "lower-alpha" ||
    input.orderedListStyle === "lower-roman" ||
    input.orderedListStyle === "cjk-ideographic"
      ? input.orderedListStyle
      : fallback.orderedListStyle;
  const linkUnderline =
    input.linkUnderline === "solid" ||
    input.linkUnderline === "dashed" ||
    input.linkUnderline === "none"
      ? input.linkUnderline
      : fallback.linkUnderline;
  return {
    strongColor: color(input.strongColor, fallback.strongColor),
    strongHighlight:
      input.strongHighlight === "" ? "" : color(input.strongHighlight, fallback.strongHighlight),
    italicColor: color(input.italicColor, fallback.italicColor),
    strikeColor: color(input.strikeColor, fallback.strikeColor),
    linkColor: color(input.linkColor, fallback.linkColor),
    linkUnderline,
    unorderedListStyle,
    orderedListStyle,
    listIndent: num(input.listIndent, fallback.listIndent, 16, 80),
    listSpacing: num(input.listSpacing, fallback.listSpacing, 0, 32),
    quoteBackground: color(input.quoteBackground, fallback.quoteBackground),
    quoteBorderColor: color(input.quoteBorderColor, fallback.quoteBorderColor),
    quoteBorderWidth: num(input.quoteBorderWidth, fallback.quoteBorderWidth, 0, 16),
    quoteRadius: num(input.quoteRadius, fallback.quoteRadius, 0, 32),
    quotePadding: num(input.quotePadding, fallback.quotePadding, 8, 48),
    codeBackground: color(input.codeBackground, fallback.codeBackground),
    codeColor: color(input.codeColor, fallback.codeColor),
    codeFontSize: num(input.codeFontSize, fallback.codeFontSize, 18, 42),
    codeRadius: num(input.codeRadius, fallback.codeRadius, 0, 32),
    inlineCodeBackground: color(input.inlineCodeBackground, fallback.inlineCodeBackground),
    inlineCodeColor: color(input.inlineCodeColor, fallback.inlineCodeColor),
  };
}

function parseQrCode(raw: unknown): XhsQrCodeStyle {
  const input = raw && typeof raw === "object" ? (raw as Partial<XhsQrCodeStyle>) : {};
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_XHS_QR_CODE.enabled,
    showOnCover:
      typeof input.showOnCover === "boolean" ? input.showOnCover : DEFAULT_XHS_QR_CODE.showOnCover,
    url: typeof input.url === "string" ? input.url.slice(0, 2_000) : DEFAULT_XHS_QR_CODE.url,
    position: isIdentifierPosition(input.position) ? input.position : DEFAULT_XHS_QR_CODE.position,
    scale: num(input.scale, DEFAULT_XHS_QR_CODE.scale, 0.5, 2),
  };
}

/** 宽松解析：任何一个字段坏掉都只回落到默认值，不会丢掉整份样式。 */
export function parseXhsStyle(raw: unknown): XhsStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<XhsStyle>;
  const theme = getXhsTheme(typeof input.themeId === "string" ? input.themeId : "");
  const d = theme.defaults;
  const aspectRatio = isAspectRatio(input.aspectRatio) ? input.aspectRatio : "3:4";
  return {
    themeId: theme.id,
    aspectRatio,
    customWidth: num(input.customWidth, XHS_CANVAS_WIDTH, 720, 2_160),
    customHeight: num(input.customHeight, XHS_CANVAS_HEIGHT, 720, 2_160),
    fontFamily: isFontChoice(input.fontFamily) ? input.fontFamily : d.fontFamily,
    fontSize: num(input.fontSize, d.fontSize, 24, 60),
    fontWeight: num(input.fontWeight, d.fontWeight, 200, 800),
    letterSpacing: num(input.letterSpacing, d.letterSpacing, 0, 8),
    lineHeight: num(input.lineHeight, d.lineHeight, 1.3, 2.6),
    textIndent: typeof input.textIndent === "boolean" ? input.textIndent : d.textIndent,
    paragraphSpacing: num(input.paragraphSpacing, d.paragraphSpacing, 0.3, 1.6),
    padding: num(input.padding, d.padding, 32, 160),
    background: color(input.background, d.background),
    textColor: color(input.textColor, d.textColor),
    accentColor: color(input.accentColor, d.accentColor),
    showPageNumber:
      typeof input.showPageNumber === "boolean" ? input.showPageNumber : d.showPageNumber,
    showPageNumberOnCover:
      typeof input.showPageNumberOnCover === "boolean"
        ? input.showPageNumberOnCover
        : d.showPageNumberOnCover,
    pageNumberAlign: isAlign(input.pageNumberAlign) ? input.pageNumberAlign : d.pageNumberAlign,
    pageNumberScale: num(
      input.pageNumberScale,
      d.pageNumberScale,
      XHS_PAGE_NUMBER_SCALE_RANGE.min,
      XHS_PAGE_NUMBER_SCALE_RANGE.max,
    ),
    pageNumberGap: num(input.pageNumberGap, d.pageNumberGap, 0, 16),
    headingTemplate: XHS_HEADING_TEMPLATES.includes(input.headingTemplate as XhsHeadingTemplate)
      ? (input.headingTemplate as XhsHeadingTemplate)
      : "classic",
    headings: parseHeadings(input.headings),
    bodyTitleOverride:
      typeof input.bodyTitleOverride === "string"
        ? input.bodyTitleOverride.slice(0, XHS_BODY_TITLE_MAX_LENGTH)
        : "",
    cover: parseCover(input.cover),
    identifier: parseIdentifier(input.identifier),
    elements: parseElements(input.elements, xhsElementsFromTheme(theme)),
    qrCode: parseQrCode(input.qrCode),
    exportSizeId: XHS_EXPORT_SIZES.some((size) => size.id === input.exportSizeId)
      ? (input.exportSizeId as string)
      : XHS_EXPORT_SIZES[0].id,
  };
}

export function getXhsCanvasSize(
  style: Pick<XhsStyle, "aspectRatio" | "customWidth" | "customHeight">,
): {
  width: number;
  height: number;
} {
  if (style.aspectRatio === "custom") {
    return {
      width: Math.round(Math.min(2_160, Math.max(720, style.customWidth))),
      height: Math.round(Math.min(2_160, Math.max(720, style.customHeight))),
    };
  }
  const ratio = XHS_ASPECT_RATIOS.find((candidate) => candidate.value === style.aspectRatio);
  const resolved = ratio ?? XHS_ASPECT_RATIOS[0];
  return { width: resolved.width, height: resolved.height };
}

/** 返回统一使用的默认导出尺寸；可选 id 仅用于兼容旧配置与测试。 */
export function getExportSize(id?: string): XhsExportSize {
  return XHS_EXPORT_SIZES.find((size) => size.id === id) ?? XHS_EXPORT_SIZES[0];
}

/** 小红书各内容区域的独立限制。图片正文与发布用内容正文不可混用。 */
export const XHS_LIMITS = {
  /** Markdown 图片正文的字数硬上限。 */
  imageBodyWords: 5_000,
  /** Markdown 图片正文的字符数硬上限。 */
  imageBodyChars: 20_000,
  /** 超过此页数时平台会自动按视频发布；仅提醒，不阻止导出。 */
  imagePages: 18,
  /** 发布到小红书笔记顶部的内容正文标题。 */
  contentTitle: 20,
  /** 发布到小红书笔记正文区域的纯文本。 */
  contentBody: 1_000,
  /** 达到 90% 就提醒。 */
  warnRatio: 0.9,
};

/** 编辑器允许的硬上限；平台限制以内正常显示，超出后由界面警告。 */
export const XHS_INPUT_LIMITS = {
  contentTitle: 25,
};

export function isXhsImagePagesOverLimit(total: number): boolean {
  return total > XHS_LIMITS.imagePages;
}
