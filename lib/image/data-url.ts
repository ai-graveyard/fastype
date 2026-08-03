/**
 * 内嵌图片的 data URI。
 *
 * 本地图片一律转成 data URI 写进 Markdown，而不是存在别处再引用——「一篇 Markdown，
 * 写完就能带走」这句话得站得住：文件拷到哪里图都还在，不依赖 FasType 也不依赖图床。
 *
 * 代价是源码里会出现很长一串 base64。编辑器把它折叠成一个短标签（见 markdown-editor.tsx
 * 的 data URI 折叠），所以写作时看到的仍然是 `![说明](图片 234 KB)` 这样的一行。
 */

/** 只认图片，其它 data URI（字体、脚本）不在这条路上。 */
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

/** 折叠触发阈值：短到这个程度的 data URI 直接显示也不碍事。 */
export const DATA_URL_FOLD_THRESHOLD = 64;

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
