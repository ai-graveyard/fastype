import {
  blockKindOf,
  type MeasuredBlock,
  type MeasuredChild,
  type PlacedBlock,
} from "@/lib/markdown/paginate";

/**
 * 小红书分页的 DOM 侧：把渲染好的内容量出高度，并在需要时按可预测的规则拆块。
 * 纯计算的分页规则在 lib/markdown/paginate.ts，这里只负责测量与克隆。
 */

const SPLIT_CLASS = "ft-split";

interface TextPoint {
  node: Text;
  offset: number;
}

function textPoints(element: HTMLElement): { points: TextPoint[]; text: string } {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const points: TextPoint[] = [];
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (let offset = 0; offset < node.length; offset += 1) points.push({ node, offset });
    text += node.data;
  }
  return { points, text };
}

function fragmentAt(
  element: HTMLElement,
  points: TextPoint[],
  from: number,
  to: number,
): DocumentFragment {
  const range = document.createRange();
  if (from === 0) range.setStart(element, 0);
  else range.setStart(points[from].node, points[from].offset);
  if (to === points.length) range.setEnd(element, element.childNodes.length);
  else range.setEnd(points[to].node, points[to].offset);
  return range.cloneContents();
}

/** 按真实行盒分段，Range 克隆保留加粗、链接等行内结构。 */
function prepareParagraph(paragraph: HTMLElement): void {
  if (paragraph.querySelector("img, pre, table, .ft-split")) return;
  const { points, text } = textPoints(paragraph);
  if (!text) return;
  const boundaries = [0];
  const probe = document.createRange();
  if (typeof probe.getClientRects === "function") {
    let lineBottom = 0;
    for (const { segment, index } of new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(text)) {
      const start = points[index];
      const end = points[index + segment.length - 1];
      probe.setStart(start.node, start.offset);
      probe.setEnd(end.node, end.offset + 1);
      const rect = Array.from(probe.getClientRects()).find(
        (box) => box.height > 0 && box.width > 0,
      );
      if (!rect) continue;
      if (lineBottom > 0 && rect.top >= lineBottom - 1) boundaries.push(index);
      if (lineBottom === 0 || rect.top >= lineBottom - 1) {
        lineBottom = rect.bottom;
      } else {
        lineBottom = Math.max(lineBottom, rect.bottom);
      }
    }
  } else {
    // 无布局引擎的 DOM 环境仍可验证拆分时的文字和行内结构保真。
    for (const match of text.matchAll(/[。！？；!?;]+["'”’)）]*/g)) {
      const end = match.index + match[0].length;
      if (end < text.length) boundaries.push(end);
    }
  }
  if (boundaries.length < 2) return;
  boundaries.push(text.length);
  const fragments = boundaries.slice(0, -1).map((from, index) => {
    const span = document.createElement("span");
    span.className = SPLIT_CLASS;
    span.style.display = "block";
    span.style.textIndent = index === 0 ? "inherit" : "0";
    span.append(fragmentAt(paragraph, points, from, boundaries[index + 1]));
    return span;
  });
  paragraph.replaceChildren(...fragments);
}

export function prepareForMeasure(container: HTMLElement): void {
  // 离屏测量区不会触发懒加载；必须先取到图片真实尺寸，再由加载事件重排。
  container.querySelectorAll("img").forEach((image) => {
    image.loading = "eager";
  });
  container.querySelectorAll<HTMLElement>("p, li").forEach((element) => {
    if (!element.querySelector("p, ul, ol, blockquote")) prepareParagraph(element);
  });
  container.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
    if (code.querySelector(".ft-split")) return;
    const { points, text } = textPoints(code);
    const lines = text.split("\n");
    if (lines.length < 2) return;
    let from = 0;
    const spans = lines.map((line) => {
      const span = document.createElement("span");
      span.className = SPLIT_CLASS;
      span.style.display = "block";
      if (line.length > 0) span.append(fragmentAt(code, points, from, from + line.length));
      else span.textContent = "\u00a0";
      from += line.length + 1;
      return span;
    });
    code.replaceChildren(...spans);
  });
}

interface SplitTarget {
  /** 子项所在的容器；克隆时按 path 在副本里找到同一个节点。 */
  container: HTMLElement;
  path: number[];
  parts: HTMLElement[];
  /** 每个片段都要保留的子项下标，例如表头。 */
  repeat: number[];
  nested?: boolean;
}

function pathTo(root: HTMLElement, target: HTMLElement): number[] {
  const path: number[] = [];
  let node: HTMLElement | null = target;
  while (node && node !== root) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) return path;
    path.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return path;
}

/** 找出一个块可以从哪一层拆开。返回 null 表示这个块不可拆。 */
export function splitTargetOf(block: HTMLElement): SplitTarget | null {
  const tag = block.tagName.toLowerCase();

  if (tag === "ul" || tag === "ol" || tag === "blockquote") {
    const parts = Array.from(block.children).flatMap((child) => {
      const spans = Array.from(child.children) as HTMLElement[];
      return spans.length > 0 && spans.every((span) => span.classList.contains(SPLIT_CLASS))
        ? spans
        : [child as HTMLElement];
    });
    return parts.length > 1
      ? { container: block, path: [], parts, repeat: [], nested: true }
      : null;
  }

  if (tag === "table") {
    const tbody = block.querySelector("tbody");
    if (!tbody) return null;
    const rows = Array.from(tbody.children) as HTMLElement[];
    if (rows.length < 2) return null;
    return { container: tbody, path: pathTo(block, tbody), parts: rows, repeat: [] };
  }

  if (tag === "pre") {
    const code = block.querySelector("code");
    if (!code) return null;
    const parts = Array.from(code.children).filter((child) =>
      child.classList.contains(SPLIT_CLASS),
    ) as HTMLElement[];
    return parts.length > 1
      ? { container: code, path: pathTo(block, code), parts, repeat: [] }
      : null;
  }

  if (tag === "p") {
    const parts = Array.from(block.children).filter((child) =>
      child.classList.contains(SPLIT_CLASS),
    ) as HTMLElement[];
    return parts.length > 1 ? { container: block, path: [], parts, repeat: [] } : null;
  }

  return null;
}

export interface MeasureResult {
  blocks: MeasuredBlock[];
  /** 与 blocks 一一对应的源节点，克隆时用。 */
  nodes: HTMLElement[];
  /** 每个块的拆分目标路径，渲染片段时按下标取。 */
  targets: (SplitTarget | null)[];
}

/** 块高度与折叠外边距分开计量，分页时才决定页首、页尾的间距。 */
export function measureBlocks(container: HTMLElement): MeasureResult {
  const nodes = Array.from(container.children) as HTMLElement[];
  const blocks: MeasuredBlock[] = [];
  const targets: (SplitTarget | null)[] = [];

  nodes.forEach((node, index) => {
    const height = node.getBoundingClientRect().height;
    const style = getComputedStyle(node);
    const target = splitTargetOf(node);
    targets.push(target);
    let children: MeasuredChild[] | undefined;
    let chrome = 0;
    if (target) {
      const rects = target.parts.map((part) => part.getBoundingClientRect());
      children = rects.map((rect, childIndex) => ({
        index: childIndex,
        height: Math.max(
          0,
          rect.bottom - (childIndex > 0 ? rects[childIndex - 1].bottom : rect.top),
        ),
      }));
      chrome = Math.max(0, height - children.reduce((sum, child) => sum + child.height, 0));
    }
    const image = imageOf(node);
    const imageRect = image?.getBoundingClientRect();
    blocks.push({
      index,
      kind: image ? "media" : blockKindOf(node.tagName),
      height,
      children,
      chrome,
      marginTop: parseFloat(style.marginTop) || 0,
      marginBottom: parseFloat(style.marginBottom) || 0,
      ...(imageRect && imageRect.height > 0 && imageRect.width > 0
        ? {
            media: {
              height: imageRect.height,
              maxScale: Math.min(4 / 3, container.getBoundingClientRect().width / imageRect.width),
            },
          }
        : {}),
    });
  });
  return { blocks, nodes, targets };
}

function imageOf(node: HTMLElement): HTMLImageElement | null {
  if (node instanceof HTMLImageElement) return node;
  if (node.tagName !== "P" && node.tagName !== "FIGURE") return null;
  const images = node.querySelectorAll("img");
  // 图文混排、图注和多图块不能当作一张图片整体缩放。
  return images.length === 1 && !node.textContent?.trim() ? images[0] : null;
}

function resolvePath(root: HTMLElement, path: number[]): HTMLElement {
  let node: HTMLElement = root;
  for (const step of path) {
    const next = node.children[step];
    if (!(next instanceof HTMLElement)) return node;
    node = next;
  }
  return node;
}

/** 按分页结果克隆出一页要放的节点。 */
export function cloneForPage(
  placed: PlacedBlock,
  nodes: HTMLElement[],
  targets: (SplitTarget | null)[],
): HTMLElement | null {
  const source = nodes[placed.blockIndex];
  if (!source) return null;
  const clone = source.cloneNode(true) as HTMLElement;
  if (placed.imageScale !== undefined) {
    const image = imageOf(clone);
    const sourceImage = imageOf(source);
    if (image && sourceImage) {
      const rect = sourceImage.getBoundingClientRect();
      image.style.width = `${rect.width * placed.imageScale}px`;
      image.style.height = `${rect.height * placed.imageScale}px`;
      image.style.maxHeight = "none";
    }
  }
  if (!placed.childRange) return clone;

  const target = targets[placed.blockIndex];
  if (!target) return clone;

  const [from, to] = placed.childRange;
  if (target.nested) {
    const first = resolvePath(clone, pathTo(source, target.parts[from]));
    const last = resolvePath(clone, pathTo(source, target.parts[to - 1]));
    const tail = document.createRange();
    tail.selectNodeContents(clone);
    tail.setStartAfter(last);
    tail.deleteContents();
    const head = document.createRange();
    head.selectNodeContents(clone);
    head.setEndBefore(first);
    head.deleteContents();
    if (source.tagName === "OL" || source.tagName === "UL") {
      const part = target.parts[from];
      const item = part.closest("li");
      const itemIndex = Array.from(source.children).indexOf(item!);
      applyListStart(clone, Math.max(0, itemIndex));
      if (part !== item && part !== item?.firstElementChild) {
        (clone.firstElementChild as HTMLElement).style.listStyleType = "none";
      }
    }
    return clone;
  }
  const container = resolvePath(clone, target.path);
  const parts = Array.from(container.children);
  parts.forEach((part, index) => {
    const keep = index >= from && index < to;
    if (!keep && !target.repeat.includes(index)) part.remove();
  });
  return clone;
}

/** 有序列表被拆到第二页时要接着上一页的序号，不能又从 1 开始。 */
export function applyListStart(clone: HTMLElement, from: number): void {
  if (clone.tagName.toLowerCase() === "ol" && from > 0) {
    const start = Number.parseInt(clone.getAttribute("start") ?? "1", 10);
    clone.setAttribute("start", String((Number.isFinite(start) ? start : 1) + from));
  }
}

/** 最后按实际 DOM 检查不可拆块，等比缩放整个内容区，保证预览和导出都不裁切。 */
export function fitPageContent(body: HTMLElement): void {
  const children = Array.from(body.children) as HTMLElement[];
  if (children.length === 0 || body.clientHeight <= 0) return;
  const bounds = body.getBoundingClientRect();
  const height = Math.max(
    ...children.map((child) => child.getBoundingClientRect().bottom - bounds.top),
  );
  const width = Math.max(body.clientWidth, body.scrollWidth);
  const scale = Math.min(1, body.clientHeight / height, body.clientWidth / width);
  if (scale >= 1) return;
  const wrapper = document.createElement("div");
  wrapper.className = "ft-xhs-body";
  wrapper.style.display = "flow-root";
  wrapper.style.width = `${body.clientWidth}px`;
  wrapper.style.transformOrigin = "top left";
  wrapper.style.transform = `scale(${scale})`;
  wrapper.append(...children);
  body.append(wrapper);
}
