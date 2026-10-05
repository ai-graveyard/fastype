export type BlockKind = "heading" | "paragraph" | "list" | "code" | "table" | "media" | "other";

export interface MeasuredChild {
  /** 子项在父块 children 中的下标。 */
  index: number;
  height: number;
}

export interface MeasuredBlock {
  index: number;
  kind: BlockKind;
  breakBefore?: boolean;
  /** 块的边框盒高度；外边距单独计量。 */
  height: number;
  /** 可拆分块的子项；不可拆分时为空。 */
  children?: MeasuredChild[];
  /** 容器自身的固定开销（padding / border / 表头），拆开后每个片段都要重复承担。 */
  chrome?: number;
  /** 拆开时需要在每个片段重复的子项下标，例如表格的表头行。 */
  repeatChildren?: number[];
  marginTop?: number;
  marginBottom?: number;
  /** 图片本身的尺寸与横向放大上限；其余高度不参与缩放。 */
  media?: { height: number; maxScale: number };
}

export interface PlacedBlock {
  blockIndex: number;
  /** 只放了一部分子项时给出 [from, to)；整块放置时为 undefined。 */
  childRange?: [number, number];
  imageScale?: number;
}

export interface Page {
  blocks: PlacedBlock[];
  /** 该页内容无法完整放下，需要渲染层缩放并提示用户。 */
  overflow: boolean;
}

export function paginate(blocks: MeasuredBlock[], pageHeight: number, keepHeadings = true): Page[] {
  if (blocks.length === 0) return [{ blocks: [], overflow: false }];
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
    return [{ blocks: blocks.map(toPlaced), overflow: true }];
  }

  type Entry = { placed: PlacedBlock; block: MeasuredBlock; height: number };
  const pages: Page[] = [];
  let current: Entry[] = [];
  const gap = (previous: MeasuredBlock | undefined, next: MeasuredBlock) =>
    previous ? Math.max(previous.marginBottom ?? 0, next.marginTop ?? 0) : 0;
  const used = () =>
    current.reduce(
      (sum, entry, index) => sum + entry.height + gap(current[index - 1]?.block, entry.block),
      0,
    );
  const space = (block: MeasuredBlock) => pageHeight - used() - gap(current.at(-1)?.block, block);
  const add = (block: MeasuredBlock, height = block.height, placed = toPlaced(block)) => {
    current.push({ block, height, placed });
  };
  const flush = () => {
    if (current.length === 0) return;
    const last = current.at(-1)!;
    const media = last.block.media;
    // 只扩展页尾图片，不移动后续内容；宽度和增幅同时受限。
    if (media && !last.placed.imageScale && used() < pageHeight) {
      const scale = Math.min(4 / 3, media.maxScale, 1 + (pageHeight - used()) / media.height);
      if (scale > 1) {
        last.placed.imageScale = scale;
        last.height += media.height * (scale - 1);
      }
    }
    pages.push({
      blocks: current.map((entry) => entry.placed),
      overflow: used() > pageHeight + 0.5,
    });
    current = [];
  };
  const advance = () => {
    let start = current.length;
    while (keepHeadings && start > 0 && current[start - 1].block.kind === "heading") start -= 1;
    if (start === 0) return;
    const headings = current.splice(start);
    flush();
    current = headings;
  };

  for (const block of blocks) {
    if (block.breakBefore) flush();
    if (block.height <= space(block)) {
      add(block);
      continue;
    }

    if (block.media) {
      const fit = () => {
        const scale = Math.min(
          1,
          (space(block) - (block.height - block.media!.height)) / block.media!.height,
        );
        if (scale < 2 / 3) return false;
        add(block, block.height + block.media!.height * (scale - 1), {
          blockIndex: block.index,
          ...(scale < 1 ? { imageScale: scale } : {}),
        });
        return true;
      };
      if (fit()) continue;
      advance();
      if (fit()) continue;
      // 独立页仍过高的图片由渲染层完整缩放；不裁切，也不继续挤入正文。
      add(block);
      flush();
      continue;
    }

    const children = (block.children ?? []).filter(
      (child) => !block.repeatChildren?.includes(child.index),
    );
    if (children.length < 2) {
      advance();
      add(block);
      if (used() > pageHeight) flush();
      continue;
    }

    const fixed =
      (block.chrome ?? 0) +
      (block.repeatChildren ?? []).reduce(
        (sum, index) => sum + (block.children?.find((child) => child.index === index)?.height ?? 0),
        0,
      );
    let from = 0;
    while (from < children.length) {
      let to = from;
      let height = fixed;
      while (to < children.length && height + children[to].height <= space(block)) {
        height += children[to].height;
        to += 1;
      }
      // 段落尽量在页尾和续页各保留两行。
      if (block.kind === "paragraph" && children.length >= 4) {
        if (to === children.length - 1 && to - from > 2) {
          to -= 1;
          height -= children[to].height;
        }
        if (to - from === 1 && from === 0 && current.length > 0) to = from;
      }
      if (to === from) {
        if (current.some((entry) => entry.block.kind !== "heading")) {
          advance();
          continue;
        }
        // 单个不可拆子项或标题组超页：保留完整内容并走可见的缩放兜底。
        to = from + 1;
        height = fixed + children[from].height;
      }
      add(block, height, {
        blockIndex: block.index,
        childRange: [children[from].index, children[to - 1].index + 1],
      });
      from = to;
      if (from < children.length || used() > pageHeight) flush();
    }
  }
  flush();
  return pages;
}

function toPlaced(block: MeasuredBlock): PlacedBlock {
  return { blockIndex: block.index };
}

/** 从标签名推断块类型，渲染层和测试共用。 */
export function blockKindOf(tagName: string): BlockKind {
  const tag = tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "p") return "paragraph";
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "pre") return "code";
  if (tag === "table") return "table";
  if (tag === "img" || tag === "figure") return "media";
  return "other";
}
