/**
 * 正文里一张图的两种写法。
 *
 * 默认写法就是 Markdown 的 `![说明](地址)`——三个视图都把图片当块级元素居中铺满，
 * 不需要额外信息。只有当用户调过宽度或对齐时才落成 HTML：
 *
 * ```html
 * <p align="center"><img src="…" alt="说明" width="60%"></p>
 * ```
 *
 * 用 `width` / `align` 这两个 HTML 属性而不是 `style`，一来渲染层出于安全会剥掉
 * style（lib/markdown/parse.ts），二来 GitHub、Typora 这些地方也认这两个属性——
 * 文件带走之后排版还在。
 */

export const IMAGE_ALIGNMENTS = ["left", "center", "right"] as const;
export type ImageAlign = (typeof IMAGE_ALIGNMENTS)[number];

/** 宽度按百分比记；100 表示不限制。 */
export const IMAGE_WIDTH_PRESETS = [100, 75, 50, 33] as const;

export const DEFAULT_IMAGE_ALIGN: ImageAlign = "center";
export const DEFAULT_IMAGE_WIDTH = 100;

export interface ImageMarkup {
  alt: string;
  src: string;
  width: number;
  align: ImageAlign;
}

/** 文档里的一张图，连同它在源码中的位置。 */
export interface ImageMarkupMatch extends ImageMarkup {
  from: number;
  to: number;
}

const MARKDOWN_IMAGE = /!\[([^\]]*)]\(([^)\s]+)\)/g;
const HTML_IMAGE = /<p\s+align="(left|center|right)"\s*>\s*<img\b([^>]*)>\s*<\/p>|<img\b([^>]*)>/gi;

function attribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attributes);
  return match ? match[1] : "";
}

function parseWidth(raw: string): number {
  const value = Number.parseFloat(raw.replace("%", ""));
  return Number.isFinite(value) && value > 0 && value <= 100
    ? Math.round(value)
    : DEFAULT_IMAGE_WIDTH;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** 生成写回正文的那一段。默认宽度加默认对齐时退回最朴素的 Markdown。 */
export function stringifyImageMarkup(image: ImageMarkup): string {
  const alt = image.alt.replace(/[[\]]/g, "").trim();
  if (image.width >= DEFAULT_IMAGE_WIDTH && image.align === DEFAULT_IMAGE_ALIGN) {
    return `![${alt}](${image.src})`;
  }
  const width = Math.min(100, Math.max(1, Math.round(image.width)));
  const img = `<img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(alt)}" width="${width}%">`;
  return `<p align="${image.align}">${img}</p>`;
}

/** 列出正文里所有图片及其位置，按出现顺序。 */
export function findImageMarkups(source: string): ImageMarkupMatch[] {
  const found: ImageMarkupMatch[] = [];

  MARKDOWN_IMAGE.lastIndex = 0;
  for (let match = MARKDOWN_IMAGE.exec(source); match; match = MARKDOWN_IMAGE.exec(source)) {
    found.push({
      from: match.index,
      to: match.index + match[0].length,
      alt: match[1],
      src: match[2],
      width: DEFAULT_IMAGE_WIDTH,
      align: DEFAULT_IMAGE_ALIGN,
    });
  }

  HTML_IMAGE.lastIndex = 0;
  for (let match = HTML_IMAGE.exec(source); match; match = HTML_IMAGE.exec(source)) {
    // 带 <p align> 外壳的走第 1、2 组，裸 <img> 走第 3 组。
    const wrapped = match[1] !== undefined;
    const attributes = wrapped ? match[2] : match[3];
    const src = attribute(attributes, "src");
    if (!src) continue;
    found.push({
      from: match.index,
      to: match.index + match[0].length,
      alt: attribute(attributes, "alt"),
      src,
      width: parseWidth(attribute(attributes, "width")),
      align: wrapped ? (match[1] as ImageAlign) : DEFAULT_IMAGE_ALIGN,
    });
  }

  return found.sort((a, b) => a.from - b.from);
}

/** 光标落在哪张图上；不在任何图片里时返回 null。 */
export function findImageAt(source: string, position: number): ImageMarkupMatch | null {
  return (
    findImageMarkups(source).find((image) => position >= image.from && position <= image.to) ?? null
  );
}
