/**
 * 小红书卡片自动分页（PRD FT-XHS-004）。
 *
 * 这里只做纯计算：输入是量好高度的块，输出是每页放哪些块（以及块被拆开时的子项范围）。
 * 真正的 DOM 克隆放在渲染层，方便对分页规则单独做单元测试。
 *
 * 规则：
 * 0. 即使没有正文块，也保留一张空白卡片，确保预览和导出始终至少有一页。
 * 1. 块尽量整块放置；放不下就换页。
 * 2. 整块比一页还高时，按子项（列表项、代码行、表格行、段落句子）拆开，规则可预测。
 * 3. 标题不允许落在页尾当孤儿，会被顺延到下一页。
 * 4. 既放不下又拆不开的块（例如一张超高图片）单独成页并标记 overflow，交给渲染层缩放，
 *    绝不静默裁切。
 */

export type BlockKind = "heading" | "paragraph" | "list" | "code" | "table" | "media" | "other";

export interface MeasuredChild {
  /** 子项在父块 children 中的下标。 */
  index: number;
  height: number;
}

export interface MeasuredBlock {
  index: number;
  kind: BlockKind;
  /** 块的整体高度，含块间距。 */
  height: number;
  /** 可拆分块的子项；不可拆分时为空。 */
  children?: MeasuredChild[];
  /** 容器自身的固定开销（padding / border / 表头），拆开后每个片段都要重复承担。 */
  chrome?: number;
  /** 拆开时需要在每个片段重复的子项下标，例如表格的表头行。 */
  repeatChildren?: number[];
}

export interface PlacedBlock {
  blockIndex: number;
  /** 只放了一部分子项时给出 [from, to)；整块放置时为 undefined。 */
  childRange?: [number, number];
}

export interface Page {
  blocks: PlacedBlock[];
  /** 该页内容无法完整放下，需要渲染层缩放并提示用户。 */
  overflow: boolean;
}

export function paginate(blocks: MeasuredBlock[], pageHeight: number): Page[] {
  if (blocks.length === 0) return [{ blocks: [], overflow: false }];
  if (pageHeight <= 0) return [{ blocks: blocks.map(toPlaced), overflow: true }];

  const pages: Page[] = [];
  let current: PlacedBlock[] = [];
  let used = 0;
  let overflow = false;

  const flush = () => {
    if (current.length === 0) return;
    pages.push({ blocks: current, overflow });
    current = [];
    used = 0;
    overflow = false;
  };

  /** 换页前把落在页尾的孤儿标题带到下一页。 */
  const takeTrailingHeading = (): PlacedBlock | null => {
    if (current.length < 2) return null;
    const last = current[current.length - 1];
    if (last.childRange) return null;
    if (blocks[last.blockIndex]?.kind !== "heading") return null;
    current.pop();
    used -= blocks[last.blockIndex].height;
    return last;
  };

  for (const block of blocks) {
    const remaining = pageHeight - used;

    if (block.height <= remaining) {
      current.push(toPlaced(block));
      used += block.height;
      continue;
    }

    // 整块放不下，但换一页能放下：直接换页。
    if (block.height <= pageHeight) {
      const carried = takeTrailingHeading();
      flush();
      if (carried) {
        current.push(carried);
        used += blocks[carried.blockIndex].height;
      }
      current.push(toPlaced(block));
      used += block.height;
      continue;
    }

    // 整块比一整页还高：尝试按子项拆分。
    const children = block.children ?? [];
    if (children.length <= 1) {
      const carried = takeTrailingHeading();
      flush();
      if (carried) {
        current.push(carried);
        used += blocks[carried.blockIndex].height;
        flush();
      }
      // 拆不开就单独成页并标记，由渲染层等比缩放处理。
      pages.push({ blocks: [toPlaced(block)], overflow: true });
      continue;
    }

    const chrome = block.chrome ?? 0;
    const repeatHeight = (block.repeatChildren ?? []).reduce(
      (sum, index) => sum + (children.find((child) => child.index === index)?.height ?? 0),
      0,
    );
    const fixedCost = chrome + repeatHeight;

    let chunkStart = children[0].index;
    let chunkHeight = fixedCost;
    let placedAny = false;

    for (const child of children) {
      if (block.repeatChildren?.includes(child.index)) continue;

      const space = (placedAny ? pageHeight : pageHeight - used) - chunkHeight;
      if (child.height <= space) {
        chunkHeight += child.height;
        continue;
      }

      // 当前片段到此为止。
      if (child.index > chunkStart) {
        if (!placedAny) {
          const carried = takeTrailingHeading();
          if (carried) {
            // 标题顺延：这一页只放标题前的内容，标题跟着下一片段走。
            flush();
            current.push(carried);
            used += blocks[carried.blockIndex].height;
          }
        }
        current.push({ blockIndex: block.index, childRange: [chunkStart, child.index] });
        flush();
        placedAny = true;
      } else if (!placedAny) {
        flush();
        placedAny = true;
      }
      chunkStart = child.index;
      chunkHeight = fixedCost + child.height;

      // 单个子项就超过一整页（例如一行超长代码），单独成页并标记。
      if (chunkHeight > pageHeight) {
        pages.push({
          blocks: [{ blockIndex: block.index, childRange: [child.index, child.index + 1] }],
          overflow: true,
        });
        chunkStart = child.index + 1;
        chunkHeight = fixedCost;
      }
    }

    const lastIndex = children[children.length - 1].index + 1;
    if (chunkStart < lastIndex) {
      current.push({ blockIndex: block.index, childRange: [chunkStart, lastIndex] });
      used = chunkHeight;
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
