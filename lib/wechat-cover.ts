export const WECHAT_COVER_FORMATS = {
  wide: { width: 900, height: 383 },
  square: { width: 500, height: 500 },
} as const;

export type WechatCoverFormat = keyof typeof WECHAT_COVER_FORMATS;
export type WechatCoverAlign = "left" | "center" | "right";
export type WechatCoverPosition = "top" | "center" | "bottom";

export interface WechatCover {
  wideImage: string;
  squareImage: string;
  useDocumentTitle: boolean;
  title: string;
  subtitle: string;
  textColor: string;
  backgroundColor: string;
  overlayColor: string;
  overlayOpacity: number;
  align: WechatCoverAlign;
  position: WechatCoverPosition;
  showProfile: boolean;
}

export const DEFAULT_WECHAT_COVER: WechatCover = {
  wideImage: "",
  squareImage: "",
  useDocumentTitle: false,
  title: "",
  subtitle: "",
  textColor: "#ffffff",
  backgroundColor: "#18212f",
  overlayColor: "#0b1220",
  overlayOpacity: 0.38,
  align: "left",
  position: "center",
  showProfile: true,
};

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|webp);base64,/i;

function image(value: unknown): string {
  return typeof value === "string" && DATA_IMAGE_RE.test(value) ? value : "";
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && COLOR_RE.test(value) ? value : fallback;
}

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function parseWechatCover(raw: unknown): WechatCover | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<WechatCover>;
  return {
    wideImage: image(input.wideImage),
    squareImage: image(input.squareImage),
    useDocumentTitle:
      typeof input.useDocumentTitle === "boolean"
        ? input.useDocumentTitle
        : DEFAULT_WECHAT_COVER.useDocumentTitle,
    title: text(input.title, 120),
    subtitle: text(input.subtitle, 160),
    textColor: color(input.textColor, DEFAULT_WECHAT_COVER.textColor),
    backgroundColor: color(input.backgroundColor, DEFAULT_WECHAT_COVER.backgroundColor),
    overlayColor: color(input.overlayColor, DEFAULT_WECHAT_COVER.overlayColor),
    overlayOpacity:
      typeof input.overlayOpacity === "number" && Number.isFinite(input.overlayOpacity)
        ? Math.min(0.85, Math.max(0, input.overlayOpacity))
        : DEFAULT_WECHAT_COVER.overlayOpacity,
    align: pick(input.align, ["left", "center", "right"], DEFAULT_WECHAT_COVER.align),
    position: pick(input.position, ["top", "center", "bottom"], DEFAULT_WECHAT_COVER.position),
    showProfile:
      typeof input.showProfile === "boolean" ? input.showProfile : DEFAULT_WECHAT_COVER.showProfile,
  };
}

export function wechatCoverFilename(docBaseName: string, format: WechatCoverFormat): string {
  return `${docBaseName}-wechat-cover-${format === "wide" ? "900x383" : "500x500"}.png`;
}
