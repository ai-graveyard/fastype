import { toBlob } from "html-to-image";
import JSZip from "jszip";

import { downloadBlob } from "@/lib/file";

/**
 * 小红书 PNG 导出（PRD FT-XHS-005）。
 *
 * 导出的是预览里那棵一模一样的 DOM，只是没有外层缩放，所以字体、颜色、分页、
 * 图片位置必然一致。逐页渲染，单页失败不影响其它页面；全部导出时统一打包为 ZIP。
 */

export interface ExportOptions {
  /** 相对逻辑画布的像素倍率。 */
  scale: number;
  backgroundColor: string;
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
}

export interface PageExportResult {
  index: number;
  ok: boolean;
  blob?: Blob;
}

export async function renderPageToBlob(
  node: HTMLElement,
  options: Pick<ExportOptions, "scale" | "backgroundColor">,
): Promise<Blob | null> {
  return toBlob(node, {
    pixelRatio: options.scale,
    backgroundColor: options.backgroundColor,
    // 只用系统字体，跳过字体内联能省掉一轮必然失败的远程请求（PRD 10.2）。
    skipFonts: true,
    cacheBust: false,
  });
}

export async function exportPages(
  nodes: HTMLElement[],
  options: ExportOptions,
): Promise<PageExportResult[]> {
  const results: PageExportResult[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    if (options.signal?.aborted) break;
    options.onProgress?.(index + 1, nodes.length);
    try {
      const blob = await renderPageToBlob(nodes[index], options);
      results.push(blob ? { index, ok: true, blob } : { index, ok: false });
    } catch {
      // 单页失败不影响其它页（PRD 12.1）。
      results.push({ index, ok: false });
    }
  }
  return results;
}

/** `文章名-xhs-01.png`（PRD FT-XHS-005）。 */
export function pageFilename(docBaseName: string, pageIndex: number): string {
  const serial = String(pageIndex + 1).padStart(2, "0");
  return `${docBaseName}-xhs-${serial}.png`;
}

/** `文章名-xhs.zip`。 */
export function zipFilename(docBaseName: string): string {
  return `${docBaseName}-xhs.zip`;
}

export interface PagesZipResult {
  blob: Blob;
  included: number;
}

/** 将成功渲染的页面放入同一个 ZIP；失败页由调用方继续单独提示。 */
export async function buildPagesZip(
  results: PageExportResult[],
  docBaseName: string,
): Promise<PagesZipResult | null> {
  const zip = new JSZip();
  let included = 0;

  for (const result of results) {
    if (!result.ok || !result.blob) continue;
    zip.file(
      pageFilename(docBaseName, result.index),
      new Uint8Array(await result.blob.arrayBuffer()),
    );
    included += 1;
  }

  if (included === 0) return null;

  // PNG 本身已经压缩，STORE 可以避免无意义的重复压缩和额外等待。
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
    mimeType: "application/zip",
  });
  return { blob, included };
}

/** 打包完成后只触发一次浏览器下载。 */
export async function downloadPagesAsZip(
  results: PageExportResult[],
  docBaseName: string,
): Promise<number> {
  const archive = await buildPagesZip(results, docBaseName);
  if (!archive) return 0;
  downloadBlob(archive.blob, zipFilename(docBaseName));
  return archive.included;
}

/** 找出加载失败的远程图片，导出前提示用户（PRD FT-IMG-001）。 */
export function findBrokenImages(root: HTMLElement): string[] {
  const broken: string[] = [];
  root.querySelectorAll("img").forEach((img) => {
    if (!img.complete || img.naturalWidth === 0) {
      const src = img.getAttribute("src");
      if (src && !broken.includes(src)) broken.push(src);
    }
  });
  return broken;
}
