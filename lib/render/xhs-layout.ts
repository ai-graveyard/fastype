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

/** 句子边界：中文标点优先，其次是英文句号后跟空格。 */
const SENTENCE_RE = /[^。！？；!?;]+(?:[。！？；!?;]+["'”’)）]*|$)/g;

/**
 * 测量前的预处理：把长段落切成句子 span、把代码块切成行 span。
 * span 不改变排版（段落用行内 span，代码行用块级 span 配合 pre-wrap），
 * 但让「一段话比一整页还长」也能按句子拆开，而不是被裁掉。
 */
export function prepareForMeasure(container: HTMLElement): void {
  container.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.querySelector("img, pre, table")) return;
    if (paragraph.children.length > 0) return; // 含行内标记的段落保持原样，避免破坏结构
    const text = paragraph.textContent ?? "";
    const sentences = text.match(SENTENCE_RE);
    if (!sentences || sentences.length < 2) return;
    paragraph.textContent = "";
    for (const sentence of sentences) {
      const span = document.createElement("span");
      span.className = SPLIT_CLASS;
      span.textContent = sentence;
      paragraph.appendChild(span);
    }
  });

  container.querySelectorAll("pre > code").forEach((code) => {
    const text = code.textContent ?? "";
    const lines = text.split("\n");
    if (lines.length < 2) return;
    code.textContent = "";
    for (const line of lines) {
      const span = document.createElement("span");
      span.className = SPLIT_CLASS;
      span.style.display = "block";
      // 空行也要占一行高度，否则测量出来的代码块会比实际渲染矮。
      span.textContent = line.length > 0 ? line : "\u00a0";
      code.appendChild(span);
    }
  });
}

interface SplitTarget {
  /** 子项所在的容器；克隆时按 path 在副本里找到同一个节点。 */
  container: HTMLElement;
  path: number[];
  parts: HTMLElement[];
  /** 每个片段都要保留的子项下标，例如表头。 */
  repeat: number[];
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

  if (tag === "ul" || tag === "ol") {
    const parts = Array.from(block.children) as HTMLElement[];
    return parts.length > 1 ? { container: block, path: [], parts, repeat: [] } : null;
  }

  if (tag === "table") {
    const tbody = block.querySelector("tbody");
    if (!tbody) return null;
    const rows = Array.from(tbody.children) as HTMLElement[];
    if (rows.length < 2) return null;
    return { container: tbody, path: pathTo(block, tbody), parts: rows, repeat: [] };
  }

  if (tag === "blockquote") {
    const parts = Array.from(block.children) as HTMLElement[];
    return parts.length > 1 ? { container: block, path: [], parts, repeat: [] } : null;
  }

  if (tag === "pre") {
    const code = block.querySelector("code");
    if (!code) return null;
    const parts = Array.from(code.children).filter((child) =>
      child.classList.contains(SPLIT_CLASS),
    ) as HTMLElement[];
    return parts.length > 1 ? { container: code, path: pathTo(block, code), parts, repeat: [] } : null;
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

/**
 * 量高度。
 *
 * 相邻块的外边距会合并，直接读 offsetHeight 会算多。这里改用「下一个块的顶边减当前块的顶边」，
 * 合并后的真实占位自然就对了。
 */
export function measureBlocks(container: HTMLElement): MeasureResult {
  const nodes = Array.from(container.children) as HTMLElement[];
  const containerTop = container.getBoundingClientRect().top;
  const blocks: MeasuredBlock[] = [];
  const targets: (SplitTarget | null)[] = [];

  const tops = nodes.map((node) => node.getBoundingClientRect().top - containerTop);
  const totalHeight = container.getBoundingClientRect().height;

  nodes.forEach((node, index) => {
    const top = tops[index];
    const bottom = index + 1 < nodes.length ? tops[index + 1] : totalHeight;
    const height = Math.max(0, bottom - top);

    const target = splitTargetOf(node);
    targets.push(target);

    let children: MeasuredChild[] | undefined;
    let chrome = 0;
    if (target) {
      const partBottoms = target.parts.map(
        (part) => part.getBoundingClientRect().bottom - containerTop,
      );
      const firstTop = target.parts[0].getBoundingClientRect().top - containerTop;
      children = target.parts.map((_, childIndex) => ({
        index: childIndex,
        height: Math.max(
          0,
          partBottoms[childIndex] - (childIndex > 0 ? partBottoms[childIndex - 1] : firstTop),
        ),
      }));
      const childrenHeight = children.reduce((sum, child) => sum + child.height, 0);
      chrome = Math.max(0, height - childrenHeight);
    }

    blocks.push({
      index,
      kind: blockKindOf(node.tagName),
      height,
      children,
      chrome,
    });
  });

  return { blocks, nodes, targets };
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
  if (!placed.childRange) return clone;

  const target = targets[placed.blockIndex];
  if (!target) return clone;

  const [from, to] = placed.childRange;
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
    clone.setAttribute("start", String(from + 1));
  }
}
