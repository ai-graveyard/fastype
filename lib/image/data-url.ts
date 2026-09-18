/**
 * 内嵌图片的 data URI。
 *
 * 落到磁盘上的 Markdown 一律把图片写成 data URI，而不是存在别处再引用——「一篇
 * Markdown，写完就能带走」这句话得站得住：文件拷到哪里图都还在，不依赖 FasType
 * 也不依赖图床。
 *
 * 编辑期间不用这种写法：那一串 base64 存不进 localStorage，正文里放的是指向
 * IndexedDB 的短引用（lib/image/ref.ts），只在导出、下载、复制那一刻换回 data URI。
 * 历史草稿和外部拷进来的 Markdown 里仍会有内嵌 data URI，所以这套工具还得留着。
 */

/** 只认图片，其它 data URI（字体、脚本）不在这条路上。 */
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

/** 扫正文里的内嵌图片。每次新建：带 `g` 的正则有 lastIndex，共用一个迟早出错。 */
export function imageDataUrlPattern(): RegExp {
  return /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
}

/** 折叠触发阈值：短到这个程度的 data URI 直接显示也不碍事。 */
export const DATA_URL_FOLD_THRESHOLD = 64;

/** 1×1 全透明 PNG，占位用。 */
export const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function isImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL_PATTERN.test(value.trim());
}

/** data URI 解码后的字节数；base64 每 4 个字符对应 3 字节，末尾的 `=` 是补位。 */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const payload = dataUrl.slice(comma + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/** `image/webp` → `WEBP`，折叠标签上用。 */
export function dataUrlFormat(dataUrl: string): string {
  const match = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  return match ? match[1].toUpperCase() : "IMG";
}

/** data URI → Blob，用来存进 IndexedDB；不是合法的 base64 图片时返回 null。 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !isImageDataUrl(dataUrl)) return null;
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
