/**
 * 本地图片 → data URI。
 *
 * 原图直接塞进 Markdown 是不行的：一张手机拍的照片轻松四五 MB，base64 之后还要再涨
 * 三分之一，localStorage 那点配额一张就满了。所以先按目标尺寸缩一遍再编码。
 *
 * 缩到多大：小红书卡片 1080 宽、公众号正文 677 宽，1600 已经够两边用，再大只是让
 * 文件变重。GIF 例外——重编码会丢掉动画，宁可原样保留。
 */

/** 缩放后的最大边长。 */
const MAX_EDGE = 1600;
/** 有损压缩的质量；0.82 是肉眼几乎看不出差别、体积又降得下来的位置。 */
const QUALITY = 0.82;
/** 超过这个大小的原图一定要重新编码，小于它且格式合适的可以原样收下。 */
const REENCODE_THRESHOLD = 256 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
] as const;

export type EncodeImageResult =
  | { ok: true; dataUrl: string; width: number; height: number; bytes: number }
  | { ok: false; reason: "unsupportedType" | "decodeFailed" | "encodeFailed" };

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = src;
  });
}

/** 等比缩到最大边以内；本来就够小就保持原尺寸。 */
function targetSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const ratio = MAX_EDGE / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * 输出格式。
 *
 * 一律优先 WebP——它既能有损压缩又保留透明通道，没有「为了透明只能用 PNG」这回事。
 * 把 PNG 截图原样再编码成 PNG 是净亏：一张 548 KB 的图能编出 746 KB，base64 之后还要
 * 再涨三分之一。只有浏览器编不出 WebP 时才退回 PNG（要透明）或 JPEG（不要透明）。
 */
function pickOutputType(canvas: HTMLCanvasElement, hasAlpha: boolean): string {
  if (canvas.toDataURL("image/webp", QUALITY).startsWith("data:image/webp")) return "image/webp";
  return hasAlpha ? "image/png" : "image/jpeg";
}

/**
 * 把本地图片文件编码成可以直接写进 Markdown 的 data URI。
 *
 * GIF 原样保留（重编码会变成静态图）；PNG 走 PNG（可能有透明通道），其余压成 WebP，
 * 浏览器不支持 WebP 编码时退回 JPEG。
 */
export async function encodeImageFile(file: File): Promise<EncodeImageResult> {
  if (!isAcceptedImage(file)) return { ok: false, reason: "unsupportedType" };

  let source: string;
  try {
    source = await readAsDataUrl(file);
  } catch {
    return { ok: false, reason: "decodeFailed" };
  }

  // 动图重编码就成了静态图，原样收下。
  if (file.type === "image/gif") {
    return { ok: true, dataUrl: source, width: 0, height: 0, bytes: file.size };
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(source);
  } catch {
    return { ok: false, reason: "decodeFailed" };
  }

  const size = targetSize(image.naturalWidth, image.naturalHeight);
  const unchanged = size.width === image.naturalWidth && size.height === image.naturalHeight;
  // 已经够小、格式也合适的原图不必再过一遍 canvas，省一次有损重编码。
  if (unchanged && file.size <= REENCODE_THRESHOLD && file.type !== "image/bmp") {
    return { ok: true, dataUrl: source, width: size.width, height: size.height, bytes: file.size };
  }

  const canvas = window.document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, reason: "encodeFailed" };
  context.drawImage(image, 0, 0, size.width, size.height);

  const hasAlpha = file.type === "image/png" || file.type === "image/avif";
  const outputType = pickOutputType(canvas, hasAlpha);
  const dataUrl = canvas.toDataURL(outputType, QUALITY);
  if (!dataUrl.startsWith("data:image/")) return { ok: false, reason: "encodeFailed" };

  return {
    ok: true,
    dataUrl,
    width: size.width,
    height: size.height,
    // 只是给用户看的估算，不必精确到字节。
    bytes: Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
  };
}

/** 从粘贴 / 拖拽事件里挑出图片文件。 */
export function pickImageFiles(items: FileList | DataTransferItemList | null): File[] {
  if (!items) return [];
  const files: File[] = [];
  for (const item of Array.from(items as ArrayLike<File | DataTransferItem>)) {
    const file = item instanceof File ? item : item.getAsFile();
    if (file && isAcceptedImage(file)) files.push(file);
  }
  return files;
}
