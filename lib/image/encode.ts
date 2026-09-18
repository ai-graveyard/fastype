/**
 * 本地图片 → 可以收进图片库的 Blob。
 *
 * 原图直接收下是不行的：一张手机拍的照片轻松四五 MB，导出时还要 base64 再涨三分之一，
 * 换算成 Markdown 就是几兆的一行。所以先按目标尺寸缩一遍再编码。
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
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; reason: "unsupportedType" | "decodeFailed" | "encodeFailed" };

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** 解码只是为了量尺寸和画进 canvas，走 object URL 就够了，不必先 base64 一遍。 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
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
 * 把 PNG 截图原样再编码成 PNG 是净亏：一张 548 KB 的图能编出 746 KB。只有浏览器编不出
 * WebP 时才退回 PNG（要透明）或 JPEG（不要透明）。
 *
 * 支持与否是浏览器属性，拿一块 1×1 的画布问一次就够，不必为了探这一下把整张图编一遍。
 */
let webpSupport: boolean | null = null;

function supportsWebp(): boolean {
  if (webpSupport === null) {
    const probe = window.document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpSupport = probe.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport;
}

function pickOutputType(hasAlpha: boolean): string {
  if (supportsWebp()) return "image/webp";
  return hasAlpha ? "image/png" : "image/jpeg";
}

/**
 * 把本地图片文件编码成可以收进图片库的 Blob。
 *
 * GIF 原样保留（重编码会变成静态图）；其余缩放后压成 WebP，浏览器不支持 WebP 编码时
 * 按有没有透明通道退回 PNG 或 JPEG。
 */
export async function encodeImageFile(file: File): Promise<EncodeImageResult> {
  if (!isAcceptedImage(file)) return { ok: false, reason: "unsupportedType" };

  // 动图重编码就成了静态图，原样收下。
  if (file.type === "image/gif") {
    return { ok: true, blob: file, width: 0, height: 0 };
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, reason: "decodeFailed" };
  }

  const size = targetSize(image.naturalWidth, image.naturalHeight);
  const unchanged = size.width === image.naturalWidth && size.height === image.naturalHeight;
  // 已经够小、格式也合适的原图不必再过一遍 canvas，省一次有损重编码。
  if (unchanged && file.size <= REENCODE_THRESHOLD && file.type !== "image/bmp") {
    return { ok: true, blob: file, width: size.width, height: size.height };
  }

  const canvas = window.document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, reason: "encodeFailed" };
  context.drawImage(image, 0, 0, size.width, size.height);

  const hasAlpha = file.type === "image/png" || file.type === "image/avif";
  const blob = await canvasToBlob(canvas, pickOutputType(hasAlpha));
  if (!blob) return { ok: false, reason: "encodeFailed" };

  return { ok: true, blob, width: size.width, height: size.height };
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
