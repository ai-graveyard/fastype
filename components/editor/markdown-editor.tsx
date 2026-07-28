"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as redoCommand,
  undo as undoCommand,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentUnit,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  closeSearchPanel,
  getSearchQuery,
  openSearchPanel,
  search,
  searchKeymap,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import {
  Annotation,
  Compartment,
  EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  ViewUpdate,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import * as React from "react";

import { isEditorInputChangeAllowed, type EditorInputLimits } from "@/lib/markdown/stats";
import type { PlatformEditorMode } from "@/lib/types";

export interface EditorSelectionInfo {
  line: number;
  col: number;
  selectionLength: number;
}

/** 视口坐标，直接喂给 position: fixed 的浮层，不受编辑器容器的 overflow 裁剪影响。 */
export interface EditorSelectionRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface EditorSearchStatus {
  current: number;
  count: number;
}

export interface EditorApi {
  focus: () => void;
  getValue: () => string;
  getSelection: () => { text: string; from: number; to: number };
  /** 选区在视口中的位置，供划词浮层定位；无选区或编辑器未挂载时返回 null。 */
  getSelectionRect: () => EditorSelectionRect | null;
  /** 选区或文档变化时触发，浮层据此决定显示、跟随还是收起。 */
  subscribeSelection: (listener: () => void) => () => void;
  /** 上下文取值有上限，避免把整篇文章发给模型（PRD FT-AI-003）。 */
  getContextAround: (chars: number) => { before: string; after: string };
  replaceSelection: (text: string) => void;
  replaceDocument: (text: string) => void;
  insertAfterSelection: (text: string) => void;
  /**
   * 按记录的范围落笔，供划词 AI 在流式生成期间用户点开别处后仍能替换对的那一段。
   * 范围内容与 `expected` 不一致（正文被改过）时不动文档，返回 false。
   */
  replaceRange: (from: number, to: number, text: string, expected: string) => boolean;
  insertAfterRange: (to: number, text: string, expected: string, from: number) => boolean;
  toggleWrap: (before: string, after?: string) => void;
  toggleLinePrefix: (prefix: string, ordered?: boolean) => void;
  insertBlock: (text: string) => void;
  /** 选中并滚动到正文中的指定文本，不打开搜索面板。 */
  locateText: (text: string) => boolean;
  /**
   * 视口顶端所在的位置，用带小数的行号表示：12.4 表示第 12 行已经滚过了 40%。
   * 编辑器未挂载时返回 null。
   */
  getScrollLine: () => number | null;
  /** 把带小数的行号滚到视口顶端，和 getScrollLine 是一对逆操作。 */
  scrollToLine: (line: number) => void;
  /** 滚动条位置变化时触发，供预览跟随。 */
  subscribeScroll: (listener: () => void) => () => void;
  openSearch: () => void;
  closeSearch: () => void;
  configureSearch: (query: string, replacement: string) => EditorSearchStatus;
  navigateSearch: (direction: "previous" | "next") => EditorSearchStatus;
  replaceCurrentSearch: () => EditorSearchStatus;
  replaceAllSearch: () => EditorSearchStatus;
  getSearchStatus: () => EditorSearchStatus;
  subscribeSearchPanel: (listener: (open: boolean) => void) => () => void;
  subscribeSearchUpdate: (listener: () => void) => () => void;
  undo: () => void;
  redo: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (info: EditorSelectionInfo) => void;
  placeholder?: string;
  /** 变化时重建编辑器状态，让新文档不会继承上一篇的撤销历史。 */
  resetKey: string;
  ariaLabel: string;
  /** 文本模式显示 Markdown 源码与行号；预览是仍可直接编辑的 Live Preview。 */
  mode?: PlatformEditorMode;
  /** 平台正文的字数和字符数硬上限；普通 Markdown 编辑不限制。 */
  inputLimits?: EditorInputLimits;
}

const externalValueSync = Annotation.define<boolean>();

/**
 * Lovtype 源码模式的 CodeMirror 主题。
 *
 * 颜色使用 Fastype 的 CSS 变量，因此切换浅色/深色时无需重建编辑器，撤销历史也不会丢失。
 */
const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--foreground)",
    backgroundColor: "transparent",
    outline: "none",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "14px",
    lineHeight: "1.625",
    overflow: "auto",
    outline: "none",
  },
  ".cm-content": {
    padding: "12px 0 32px",
    caretColor: "var(--foreground)",
    outline: "none",
  },
  ".cm-line": {
    padding: "0 24px 0 8px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid color-mix(in oklch, var(--border), transparent 85%)",
    color: "color-mix(in oklch, var(--muted-foreground), transparent 75%)",
    fontSize: "11px",
    minWidth: "32px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    lineHeight: "22.75px",
  },
  ".cm-hoveredLineGutter": {
    color: "color-mix(in oklch, var(--muted-foreground), transparent 40%)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary), transparent 78%) !important",
    borderRadius: "2px",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-panels": {
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
  },
  ".cm-panel input, .cm-panel button": {
    fontFamily: "inherit",
    borderRadius: "4px",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklab, var(--warning) 35%, transparent)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "color-mix(in oklab, var(--warning) 60%, transparent)",
  },
  ".cm-placeholder": {
    color: "color-mix(in oklch, var(--muted-foreground), transparent 50%)",
    fontStyle: "italic",
  },
});

/** Lovtype 同款：鼠标经过时只强调当前行号，不给正文铺一整行底色。 */
const hoverLineGutterPlugin = ViewPlugin.fromClass(
  class {
    private hoveredElement: HTMLElement | null = null;
    private readonly onMove: (event: MouseEvent) => void;
    private readonly onLeave: () => void;

    constructor(readonly view: EditorView) {
      this.onMove = (event: MouseEvent) => {
        const container = this.view.dom.querySelector(".cm-lineNumbers");
        if (!container) return;

        const target = Array.from(
          container.querySelectorAll<HTMLElement>(".cm-gutterElement"),
        ).find((element) => {
          const rect = element.getBoundingClientRect();
          return (
            event.clientY >= rect.top &&
            event.clientY < rect.bottom &&
            Boolean(element.textContent?.trim())
          );
        });

        if (target === this.hoveredElement) return;
        this.clear();
        if (target) {
          target.classList.add("cm-hoveredLineGutter");
          this.hoveredElement = target;
        }
      };
      this.onLeave = () => this.clear();

      view.dom.addEventListener("mousemove", this.onMove);
      view.dom.addEventListener("mouseleave", this.onLeave);
    }

    private clear() {
      this.hoveredElement?.classList.remove("cm-hoveredLineGutter");
      this.hoveredElement = null;
    }

    destroy() {
      this.clear();
      this.view.dom.removeEventListener("mousemove", this.onMove);
      this.view.dom.removeEventListener("mouseleave", this.onLeave);
    }
  },
);

const livePreviewTheme = EditorView.theme({
  "&": {
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  ".cm-scroller": {
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "15px",
    lineHeight: "1.8",
  },
  ".cm-content": {
    width: "100%",
    maxWidth: "768px",
    margin: "0 auto",
    padding: "28px 0 48px",
  },
  ".cm-line": { padding: "0 32px" },
  ".ft-md-h1": {
    fontSize: "2em",
    fontWeight: "700",
    lineHeight: "1.25",
    paddingTop: "0.35em",
    paddingBottom: "0.2em",
  },
  ".ft-md-h2": {
    fontSize: "1.5em",
    fontWeight: "700",
    lineHeight: "1.35",
    paddingTop: "0.5em",
    paddingBottom: "0.15em",
  },
  ".ft-md-h3": { fontSize: "1.25em", fontWeight: "650", lineHeight: "1.4", paddingTop: "0.4em" },
  ".ft-md-h4, .ft-md-h5, .ft-md-h6": { fontWeight: "650", paddingTop: "0.25em" },
  ".ft-md-quote": {
    borderLeft: "3px solid var(--border)",
    color: "var(--muted-foreground)",
    paddingLeft: "16px",
  },
  ".ft-md-list": { paddingLeft: "44px" },
  ".ft-md-bullet": {
    display: "inline-block",
    width: "1em",
    marginLeft: "-1em",
    color: "var(--muted-foreground)",
  },
  ".ft-md-task-checkbox": {
    marginLeft: "-1.35em",
    marginRight: "0.5em",
    verticalAlign: "middle",
    cursor: "pointer",
  },
  ".ft-md-rule": { borderTop: "1px solid var(--border)", marginTop: "14px", color: "transparent" },
  ".ft-md-strong": { fontWeight: "700" },
  ".ft-md-strike": { textDecoration: "line-through", color: "var(--muted-foreground)" },
  ".ft-md-code": {
    borderRadius: "4px",
    backgroundColor: "var(--muted)",
    padding: "1px 4px",
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "0.9em",
  },
  ".ft-md-codeblock": {
    display: "block",
    margin: "0.9em 0",
    padding: "1em",
    backgroundColor: "var(--muted)",
    borderRadius: "8px",
    overflowX: "auto",
    whiteSpace: "pre",
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "0.85em",
    lineHeight: "1.6",
  },
  ".ft-md-link": {
    color: "var(--brand-primary)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  ".ft-md-table": {
    display: "block",
    width: "max-content",
    maxWidth: "100%",
    overflowX: "auto",
    margin: "0.9em 0",
    borderCollapse: "collapse",
    fontSize: "0.92em",
  },
  ".ft-md-table th, .ft-md-table td": {
    border: "1px solid var(--border)",
    padding: "0.4em 0.7em",
    textAlign: "left",
  },
  ".ft-md-table th": {
    background: "var(--muted)",
    fontWeight: "600",
  },
});

function overlaps(ranges: Array<[number, number]>, from: number, to: number) {
  return ranges.some(([start, end]) => from < end && to > start);
}

function addWrappedDecorations(
  ranges: Range<Decoration>[],
  occupied: Array<[number, number]>,
  lineFrom: number,
  text: string,
  pattern: RegExp,
  beforeLength: number,
  afterLength: number,
  className: string,
) {
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    if (overlaps(occupied, from, to)) continue;
    const contentFrom = from + beforeLength;
    const contentTo = to - afterLength;
    if (contentFrom >= contentTo) continue;
    occupied.push([from, to]);
    ranges.push(Decoration.replace({}).range(from, contentFrom));
    ranges.push(Decoration.mark({ class: className }).range(contentFrom, contentTo));
    ranges.push(Decoration.replace({}).range(contentTo, to));
  }
}

type TableAlign = "left" | "center" | "right" | null;

/** 是否可能是表格行：至少要含一个竖线，且不是空行。 */
function looksLikeTableRow(text: string): boolean {
  return text.trim().length > 0 && text.includes("|");
}

/** GFM 表格分隔行，例如 `| --- | :---: |`。 */
function isTableDelimiterRow(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes("-")) return false;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = body.split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

/** 按未转义的竖线切分单元格，两侧的外层竖线会被去掉。 */
function splitTableRow(text: string): string[] {
  let trimmed = text.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function alignFromDelimiterCell(cell: string): TableAlign {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

interface TableBlock {
  /** 表格块的起止行号（含）。 */
  fromLine: number;
  toLine: number;
  rows: string[][];
  aligns: TableAlign[];
}

/**
 * 从 headerLine 开始尝试解析一个 GFM 表格：下一行必须是分隔行，
 * 后续含竖线的行都当作数据行，直到遇到空行或不含竖线的行为止。
 */
function tryParseTableAt(state: EditorState, headerLineNumber: number): TableBlock | null {
  const doc = state.doc;
  if (headerLineNumber >= doc.lines) return null;
  const headerLine = doc.line(headerLineNumber);
  if (!looksLikeTableRow(headerLine.text)) return null;
  if (headerLineNumber + 1 > doc.lines) return null;

  const delimiterLine = doc.line(headerLineNumber + 1);
  if (!isTableDelimiterRow(delimiterLine.text)) return null;

  const header = splitTableRow(headerLine.text);
  const aligns = splitTableRow(delimiterLine.text).map(alignFromDelimiterCell);
  while (aligns.length < header.length) aligns.push(null);

  const rows: string[][] = [header];
  let lastLineNumber = headerLineNumber + 1;

  for (let n = headerLineNumber + 2; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    if (!looksLikeTableRow(line.text)) break;
    const cells = splitTableRow(line.text);
    if (cells.length === header.length) {
      rows.push(cells);
    } else if (cells.length > header.length) {
      rows.push(cells.slice(0, header.length));
    } else {
      rows.push([...cells, ...Array(header.length - cells.length).fill("")]);
    }
    lastLineNumber = n;
  }

  return { fromLine: headerLineNumber, toLine: lastLineNumber, rows, aligns };
}

class TableWidget extends WidgetType {
  constructor(
    readonly rows: string[][],
    readonly aligns: TableAlign[],
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      JSON.stringify(this.rows) === JSON.stringify(other.rows) &&
      JSON.stringify(this.aligns) === JSON.stringify(other.aligns)
    );
  }

  toDOM(): HTMLElement {
    const table = document.createElement("table");
    table.className = "ft-md-table";
    const [header, ...body] = this.rows;

    const applyAlign = (cell: HTMLElement, index: number) => {
      const align = this.aligns[index];
      if (align) cell.style.textAlign = align;
    };

    if (header) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      header.forEach((text, index) => {
        const th = document.createElement("th");
        th.textContent = text;
        applyAlign(th, index);
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    if (body.length > 0) {
      const tbody = document.createElement("tbody");
      body.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((text, index) => {
          const td = document.createElement("td");
          td.textContent = text;
          applyAlign(td, index);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    return table;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

interface CodeFenceBlock {
  fromLine: number;
  toLine: number;
  lang: string;
  code: string;
}

/**
 * 围栏代码块（```/~~~）：起止行必须用同一种字符，闭合围栏的重复数不少于开头。
 * 没找到闭合围栏就返回 null，按普通文本处理，不整块吞掉后面的内容。
 */
function tryParseCodeFenceAt(state: EditorState, startLineNumber: number): CodeFenceBlock | null {
  const doc = state.doc;
  if (startLineNumber > doc.lines) return null;
  const startLine = doc.line(startLineNumber);
  const open = startLine.text.match(/^\s{0,3}(`{3,}|~{3,})\s*([^\s`~]*)\s*$/);
  if (!open) return null;

  const fenceChar = open[1][0];
  const fenceLength = open[1].length;
  const lang = open[2] ?? "";
  const closeRe = new RegExp(`^\\s{0,3}[${fenceChar}]{${fenceLength},}\\s*$`);

  const codeLines: string[] = [];
  for (let n = startLineNumber + 1; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    if (closeRe.test(line.text)) {
      return { fromLine: startLineNumber, toLine: n, lang, code: codeLines.join("\n") };
    }
    codeLines.push(line.text);
  }
  return null;
}

class CodeBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly lang: string,
  ) {
    super();
  }

  eq(other: CodeBlockWidget): boolean {
    return this.code === other.code && this.lang === other.lang;
  }

  toDOM(): HTMLElement {
    const pre = document.createElement("pre");
    pre.className = "ft-md-codeblock";
    const code = document.createElement("code");
    if (this.lang) code.className = `language-${this.lang}`;
    code.textContent = this.code;
    pre.appendChild(code);
    return pre;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** 用于把无序列表的 `-`/`+`/`*` 标记换成统一的实心圆点。 */
class InlineTextWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string,
  ) {
    super();
  }

  eq(other: InlineTextWidget): boolean {
    return this.text === other.text && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.className;
    span.textContent = this.text;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 任务列表 `- [ ]` / `- [x]` 的复选框：点击直接切换文档里对应字符（" " ↔ "x"），
 * 不需要先进入源码模式再手改，和大多数所见即所得编辑器的习惯一致。
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly view: EditorView,
    readonly checked: boolean,
    readonly statePos: number,
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.statePos === other.statePos;
  }

  toDOM(): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "ft-md-task-checkbox";
    input.checked = this.checked;
    input.addEventListener("mousedown", (event) => event.preventDefault());
    input.addEventListener("click", () => {
      this.view.dispatch({
        changes: { from: this.statePos, to: this.statePos + 1, insert: this.checked ? " " : "x" },
      });
    });
    return input;
  }

  // 完全交给上面的点击处理，不让 CodeMirror 把点击当成落在这个位置的普通点选。
  ignoreEvent(): boolean {
    return true;
  }
}

function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const activeLines = new Set<number>();
  for (const selection of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(selection.from).number;
    const last = view.state.doc.lineAt(selection.to).number;
    for (let number = first; number <= last; number += 1) activeLines.add(number);
  }

  for (const visible of view.visibleRanges) {
    let position = visible.from;
    while (position <= visible.to) {
      const line = view.state.doc.lineAt(position);
      const text = line.text;
      const active = activeLines.has(line.number);
      const heading = text.match(/^(#{1,6})\s+/);
      const quote = text.match(/^\s*>\s?/);
      const task = text.match(/^(\s*)([-+*])(\s+)\[([ xX])\](?=\s|$)/);
      const unordered = text.match(/^(\s*)([-+*])(\s+)/);
      const ordered = text.match(/^(\s*)(\d+\.)(\s+)/);

      if (heading) {
        ranges.push(
          Decoration.line({ attributes: { class: `ft-md-h${heading[1].length}` } }).range(
            line.from,
          ),
        );
        if (!active)
          ranges.push(Decoration.replace({}).range(line.from, line.from + heading[0].length));
      } else if (quote) {
        ranges.push(Decoration.line({ attributes: { class: "ft-md-quote" } }).range(line.from));
        if (!active)
          ranges.push(Decoration.replace({}).range(line.from, line.from + quote[0].length));
      } else if (task) {
        ranges.push(
          Decoration.line({ attributes: { class: "ft-md-list ft-md-task" } }).range(line.from),
        );
        if (!active) {
          const bracketOpen = line.from + task[1].length + task[2].length + task[3].length;
          const statePos = bracketOpen + 1;
          const checked = task[4].toLowerCase() === "x";
          ranges.push(
            Decoration.replace({
              widget: new TaskCheckboxWidget(view, checked, statePos),
            }).range(line.from + task[1].length, bracketOpen + 3),
          );
        }
      } else if (unordered) {
        ranges.push(Decoration.line({ attributes: { class: "ft-md-list" } }).range(line.from));
        if (!active) {
          const markerFrom = line.from + unordered[1].length;
          const markerTo = markerFrom + unordered[2].length;
          ranges.push(
            Decoration.replace({ widget: new InlineTextWidget("•", "ft-md-bullet") }).range(
              markerFrom,
              markerTo,
            ),
          );
        }
      } else if (ordered) {
        ranges.push(Decoration.line({ attributes: { class: "ft-md-list" } }).range(line.from));
      } else if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(text)) {
        ranges.push(Decoration.line({ attributes: { class: "ft-md-rule" } }).range(line.from));
      }

      if (!active) {
        const occupied: Array<[number, number]> = [];
        addWrappedDecorations(ranges, occupied, line.from, text, /`([^`]+)`/g, 1, 1, "ft-md-code");
        addWrappedDecorations(
          ranges,
          occupied,
          line.from,
          text,
          /\*\*(.+?)\*\*/g,
          2,
          2,
          "ft-md-strong",
        );
        addWrappedDecorations(
          ranges,
          occupied,
          line.from,
          text,
          /~~(.+?)~~/g,
          2,
          2,
          "ft-md-strike",
        );

        const linkPattern = /\[([^\]]+)]\(([^)]+)\)/g;
        for (let match = linkPattern.exec(text); match; match = linkPattern.exec(text)) {
          const from = line.from + match.index;
          const to = from + match[0].length;
          if (overlaps(occupied, from, to)) continue;
          const labelFrom = from + 1;
          const labelTo = labelFrom + match[1].length;
          occupied.push([from, to]);
          ranges.push(Decoration.replace({}).range(from, labelFrom));
          ranges.push(Decoration.mark({ class: "ft-md-link" }).range(labelFrom, labelTo));
          ranges.push(Decoration.replace({}).range(labelTo, to));
        }
      }

      if (line.to >= visible.to) break;
      position = line.to + 1;
    }
  }

  return Decoration.set(ranges, true);
}

/**
 * 表格、围栏代码块都是多行拼成的块，用 Widget 整体替换成真实的 `<table>` / `<pre>`。
 *
 * CodeMirror 不允许「随视图变化的」decoration 提供块级效果（无论是插件还是
 * `EditorView.decorations.of(view => ...)` 这种函数形式都不行），只有 StateField
 * 里存的、随 state 计算好的静态 DecorationSet 才被允许，所以这里单独用一个
 * StateField，和上面基于行的 `buildLivePreviewDecorations`（ViewPlugin）分开。
 */
function buildBlockWidgetDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const activeLines = new Set<number>();
  for (const selection of state.selection.ranges) {
    const first = state.doc.lineAt(selection.from).number;
    const last = state.doc.lineAt(selection.to).number;
    for (let number = first; number <= last; number += 1) activeLines.add(number);
  }
  const isBlockActive = (fromLine: number, toLine: number) => {
    for (let n = fromLine; n <= toLine; n += 1) {
      if (activeLines.has(n)) return true;
    }
    return false;
  };

  const doc = state.doc;
  let lineNumber = 1;
  while (lineNumber <= doc.lines) {
    const fence = tryParseCodeFenceAt(state, lineNumber);
    if (fence) {
      if (!isBlockActive(fence.fromLine, fence.toLine)) {
        const startLine = doc.line(fence.fromLine);
        const endLine = doc.line(fence.toLine);
        ranges.push(
          Decoration.replace({
            widget: new CodeBlockWidget(fence.code, fence.lang),
            block: true,
          }).range(startLine.from, endLine.to),
        );
      }
      lineNumber = fence.toLine + 1;
      continue;
    }

    const table = tryParseTableAt(state, lineNumber);
    if (table) {
      if (!isBlockActive(table.fromLine, table.toLine)) {
        const startLine = doc.line(table.fromLine);
        const endLine = doc.line(table.toLine);
        ranges.push(
          Decoration.replace({
            widget: new TableWidget(table.rows, table.aligns),
            block: true,
          }).range(startLine.from, endLine.to),
        );
      }
      lineNumber = table.toLine + 1;
      continue;
    }

    lineNumber += 1;
  }

  return Decoration.set(ranges, true);
}

const blockWidgetDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildBlockWidgetDecorations(state);
  },
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) return value;
    return buildBlockWidgetDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations },
);

function editorModeExtensions(mode: PlatformEditorMode): Extension {
  return mode === "preview"
    ? [
        EditorView.editorAttributes.of({ class: "ft-markdown-live-preview" }),
        livePreviewTheme,
        livePreviewPlugin,
        blockWidgetDecorationsField,
      ]
    : [lineNumbers(), hoverLineGutterPlugin];
}

function getMatches(
  view: EditorView,
  query = getSearchQuery(view.state),
): Array<{ from: number; to: number }> {
  if (!query.valid || !query.search) return [];
  const cursor = query.getCursor(view.state);
  const matches: Array<{ from: number; to: number }> = [];
  for (let result = cursor.next(); !result.done; result = cursor.next()) {
    matches.push(result.value);
  }
  return matches;
}

function getCurrentSearchStatus(view: EditorView): EditorSearchStatus {
  const matches = getMatches(view);
  if (matches.length === 0) return { current: 0, count: 0 };

  const selection = view.state.selection.main;
  const selectedIndex = matches.findIndex(
    (match) => match.from === selection.from && match.to === selection.to,
  );
  const nextIndex = matches.findIndex((match) => match.from >= selection.head);
  return {
    current: (selectedIndex >= 0 ? selectedIndex : nextIndex >= 0 ? nextIndex : 0) + 1,
    count: matches.length,
  };
}

/**
 * 视口顶端在「文档坐标」里的高度。
 *
 * CodeMirror 的 lineBlockAtHeight / block.top 都以文档顶部为原点，而
 * documentTop 给的是文档顶部在视口里的位置，两者相减才对得上。
 */
function viewportTopInDocument(view: EditorView): number {
  return view.scrollDOM.getBoundingClientRect().top - view.documentTop;
}

function selectSearchMatch(view: EditorView, match: { from: number; to: number }) {
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: EditorView.scrollIntoView(match.from, { y: "center" }),
  });
}

export const MarkdownEditor = React.forwardRef<EditorApi, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      onSelectionChange,
      placeholder,
      resetKey,
      ariaLabel,
      mode = "text",
      inputLimits,
    },
    ref,
  ) {
    const hostRef = React.useRef<HTMLDivElement>(null);
    const viewRef = React.useRef<EditorView | null>(null);
    const searchPanelListenersRef = React.useRef(new Set<(open: boolean) => void>());
    const searchUpdateListenersRef = React.useRef(new Set<() => void>());
    const selectionListenersRef = React.useRef(new Set<() => void>());
    const scrollListenersRef = React.useRef(new Set<() => void>());
    const modeCompartmentRef = React.useRef(new Compartment());
    const inputLimitsRef = React.useRef(inputLimits);

    // 回调放在 ref 里，避免每次父组件重渲染都重建整个编辑器。
    const onChangeRef = React.useRef(onChange);
    const onSelectionRef = React.useRef(onSelectionChange);
    React.useEffect(() => {
      onChangeRef.current = onChange;
      onSelectionRef.current = onSelectionChange;
      inputLimitsRef.current = inputLimits;
    });

    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const extensions: Extension[] = [
        EditorState.transactionFilter.of((transaction) => {
          if (!transaction.docChanged || transaction.annotation(externalValueSync)) {
            return transaction;
          }
          const limits = inputLimitsRef.current;
          if (!limits) return transaction;

          return isEditorInputChangeAllowed(
            transaction.startState.doc.toString(),
            transaction.newDoc.toString(),
            limits,
          )
            ? transaction
            : [];
        }),
        drawSelection(),
        modeCompartmentRef.current.of(editorModeExtensions(mode)),
        history(),
        closeBrackets(),
        indentOnInput(),
        bracketMatching(),
        search({
          top: true,
          // React 工具栏负责显示界面；隐藏面板只用于启用 CodeMirror 的匹配高亮。
          createPanel: () => {
            const dom = document.createElement("div");
            dom.hidden = true;
            return { dom };
          },
        }),
        EditorView.lineWrapping,
        indentUnit.of("  "),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        baseTheme,
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        keymap.of([
          ...closeBracketsKeymap,
          {
            key: "Mod-f",
            run: (view) => {
              openSearchPanel(view);
              searchPanelListenersRef.current.forEach((listener) => listener(true));
              return true;
            },
          },
          {
            key: "Escape",
            run: (view) => {
              if (!searchPanelOpen(view.state)) return false;
              closeSearchPanel(view);
              searchPanelListenersRef.current.forEach((listener) => listener(false));
              return true;
            },
          },
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) {
            const range = update.state.selection.main;
            const line = update.state.doc.lineAt(range.head);
            onSelectionRef.current?.({
              line: line.number,
              col: range.head - line.from + 1,
              selectionLength: Math.abs(range.to - range.from),
            });
            searchUpdateListenersRef.current.forEach((listener) => listener());
            selectionListenersRef.current.forEach((listener) => listener());
          }
          // 滚动不改变选区，但浮层要跟着选区一起移动。
          if (update.geometryChanged) {
            selectionListenersRef.current.forEach((listener) => listener());
          }
        }),
      ];

      if (placeholder) extensions.push(placeholderExt(placeholder));

      const view = new EditorView({
        state: EditorState.create({ doc: value, extensions }),
        parent: host,
      });
      viewRef.current = view;

      // scroll 事件不冒泡，只能挂在滚动容器自己身上。
      const onScroll = () => scrollListenersRef.current.forEach((listener) => listener());
      view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        view.scrollDOM.removeEventListener("scroll", onScroll);
        view.destroy();
        viewRef.current = null;
      };
      // resetKey 变化才重建：新建/打开文件时清空撤销历史。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey, placeholder, ariaLabel]);

    React.useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: modeCompartmentRef.current.reconfigure(editorModeExtensions(mode)),
      });
    }, [mode]);

    // 外部改动（例如清除草稿）同步进来；来自编辑器自身的变化会被这个相等判断挡掉。
    React.useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === value) return;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: externalValueSync.of(true),
      });
    }, [value]);

    React.useImperativeHandle(
      ref,
      (): EditorApi => ({
        focus: () => viewRef.current?.focus(),

        getValue: () => viewRef.current?.state.doc.toString() ?? "",

        getSelection: () => {
          const view = viewRef.current;
          if (!view) return { text: "", from: 0, to: 0 };
          const { from, to } = view.state.selection.main;
          return { text: view.state.sliceDoc(from, to), from, to };
        },

        getSelectionRect: () => {
          const view = viewRef.current;
          if (!view) return null;
          const { from, to } = view.state.selection.main;
          if (from === to) return null;
          const start = view.coordsAtPos(from);
          const end = view.coordsAtPos(to);
          if (!start || !end) return null;
          return {
            top: Math.min(start.top, end.top),
            bottom: Math.max(start.bottom, end.bottom),
            left: Math.min(start.left, end.left),
            right: Math.max(start.right, end.right),
          };
        },

        subscribeSelection: (listener) => {
          selectionListenersRef.current.add(listener);
          return () => {
            selectionListenersRef.current.delete(listener);
          };
        },

        getContextAround: (chars) => {
          const view = viewRef.current;
          if (!view) return { before: "", after: "" };
          const { from, to } = view.state.selection.main;
          return {
            before: view.state.sliceDoc(Math.max(0, from - chars), from),
            after: view.state.sliceDoc(to, Math.min(view.state.doc.length, to + chars)),
          };
        },

        // 走一次普通事务，所以 Cmd/Ctrl+Z 能原样撤回（PRD FT-AI-004）。
        replaceSelection: (text) => {
          const view = viewRef.current;
          if (!view) return;
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from, head: from + text.length },
          });
          view.focus();
        },

        // 全文替换仍走 CodeMirror 事务，用户可以用 Cmd/Ctrl+Z 撤销。
        replaceDocument: (text) => {
          const view = viewRef.current;
          if (!view) return;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            selection: { anchor: Math.min(text.length, view.state.selection.main.head) },
            userEvent: "input.ai.document",
          });
          view.focus();
        },

        replaceRange: (from, to, text, expected) => {
          const view = viewRef.current;
          if (!view) return false;
          if (to > view.state.doc.length) return false;
          if (view.state.sliceDoc(from, to) !== expected) return false;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from, head: from + text.length },
            userEvent: "input.ai.selection",
          });
          view.focus();
          return true;
        },

        insertAfterRange: (to, text, expected, from) => {
          const view = viewRef.current;
          if (!view) return false;
          if (to > view.state.doc.length) return false;
          if (view.state.sliceDoc(from, to) !== expected) return false;
          const insert = `\n\n${text}`;
          view.dispatch({
            changes: { from: to, to, insert },
            selection: { anchor: to + insert.length },
            userEvent: "input.ai.selection",
          });
          view.focus();
          return true;
        },

        insertAfterSelection: (text) => {
          const view = viewRef.current;
          if (!view) return;
          const { to } = view.state.selection.main;
          const insert = `\n\n${text}`;
          view.dispatch({
            changes: { from: to, to, insert },
            selection: { anchor: to + insert.length },
          });
          view.focus();
        },

        toggleWrap: (before, after = before) => {
          const view = viewRef.current;
          if (!view) return;
          const { from, to } = view.state.selection.main;
          const selected = view.state.sliceDoc(from, to);
          const outer = view.state.sliceDoc(
            Math.max(0, from - before.length),
            Math.min(view.state.doc.length, to + after.length),
          );

          if (outer === `${before}${selected}${after}`) {
            // 已经包着标记就取消，按钮是切换而不是无限叠加。
            view.dispatch({
              changes: {
                from: from - before.length,
                to: to + after.length,
                insert: selected,
              },
              selection: { anchor: from - before.length, head: to - before.length },
            });
          } else {
            view.dispatch({
              changes: { from, to, insert: `${before}${selected}${after}` },
              selection: {
                anchor: from + before.length,
                head: from + before.length + selected.length,
              },
            });
          }
          view.focus();
        },

        toggleLinePrefix: (prefix, ordered = false) => {
          const view = viewRef.current;
          if (!view) return;
          const { from, to } = view.state.selection.main;
          const first = view.state.doc.lineAt(from);
          const last = view.state.doc.lineAt(to);
          const changes: { from: number; to: number; insert: string }[] = [];
          let counter = 1;

          for (let n = first.number; n <= last.number; n += 1) {
            const line = view.state.doc.line(n);
            const mark = ordered ? `${counter}. ` : prefix;
            counter += 1;
            const existing = ordered ? line.text.match(/^\d+\.\s/)?.[0] : undefined;
            const current = existing ?? prefix;
            if (line.text.startsWith(current)) {
              changes.push({ from: line.from, to: line.from + current.length, insert: "" });
            } else {
              changes.push({ from: line.from, to: line.from, insert: mark });
            }
          }
          view.dispatch({ changes });
          view.focus();
        },

        insertBlock: (text) => {
          const view = viewRef.current;
          if (!view) return;
          const { from, to } = view.state.selection.main;
          const line = view.state.doc.lineAt(from);
          const needsLeadingBreak = line.text.trim().length > 0;
          const insert = `${needsLeadingBreak ? "\n\n" : ""}${text}`;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
          });
          view.focus();
        },

        locateText: (text) => {
          const view = viewRef.current;
          if (!view || !text) return false;
          const query = new SearchQuery({
            search: text,
            caseSensitive: false,
            literal: true,
          });
          const match = getMatches(view, query)[0];
          if (!match) return false;
          selectSearchMatch(view, match);
          view.focus();
          return true;
        },

        getScrollLine: () => {
          const view = viewRef.current;
          if (!view) return null;
          const height = viewportTopInDocument(view);
          const block = view.lineBlockAtHeight(height);
          const line = view.state.doc.lineAt(block.from).number;
          // 折行的长段落一个 block 可能有好几屏高，带上块内进度才不会一跳一跳。
          const progress = block.height > 0 ? (height - block.top) / block.height : 0;
          return line + Math.min(Math.max(progress, 0), 1);
        },

        scrollToLine: (line) => {
          const view = viewRef.current;
          if (!view) return;
          const whole = Math.min(Math.max(Math.floor(line), 1), view.state.doc.lines);
          const block = view.lineBlockAt(view.state.doc.line(whole).from);
          const progress = Math.min(Math.max(line - whole, 0), 1);
          const target = block.top + block.height * progress;
          view.scrollDOM.scrollTop += target - viewportTopInDocument(view);
        },

        subscribeScroll: (listener) => {
          scrollListenersRef.current.add(listener);
          return () => {
            scrollListenersRef.current.delete(listener);
          };
        },

        openSearch: () => {
          const view = viewRef.current;
          if (!view) return;
          openSearchPanel(view);
          searchPanelListenersRef.current.forEach((listener) => listener(true));
        },

        closeSearch: () => {
          const view = viewRef.current;
          if (!view) return;
          closeSearchPanel(view);
          searchPanelListenersRef.current.forEach((listener) => listener(false));
        },

        configureSearch: (searchText, replacement) => {
          const view = viewRef.current;
          if (!view) return { current: 0, count: 0 };
          if (!searchPanelOpen(view.state)) openSearchPanel(view);

          const previous = getSearchQuery(view.state);
          const query = new SearchQuery({
            search: searchText,
            replace: replacement,
            caseSensitive: false,
            literal: true,
          });
          view.dispatch({ effects: setSearchQuery.of(query) });

          const matches = getMatches(view, query);
          if (matches.length === 0) return { current: 0, count: 0 };
          if (previous.search !== searchText) selectSearchMatch(view, matches[0]);
          return getCurrentSearchStatus(view);
        },

        navigateSearch: (direction) => {
          const view = viewRef.current;
          if (!view) return { current: 0, count: 0 };
          const matches = getMatches(view);
          if (matches.length === 0) return { current: 0, count: 0 };

          const selection = view.state.selection.main;
          const selectedIndex = matches.findIndex(
            (match) => match.from === selection.from && match.to === selection.to,
          );
          let targetIndex: number;
          if (selectedIndex >= 0) {
            const offset = direction === "next" ? 1 : -1;
            targetIndex = (selectedIndex + offset + matches.length) % matches.length;
          } else if (direction === "next") {
            const nextIndex = matches.findIndex((match) => match.from >= selection.head);
            targetIndex = nextIndex >= 0 ? nextIndex : 0;
          } else {
            const previousIndex = matches.findLastIndex((match) => match.to <= selection.from);
            targetIndex = previousIndex >= 0 ? previousIndex : matches.length - 1;
          }
          selectSearchMatch(view, matches[targetIndex]);
          return getCurrentSearchStatus(view);
        },

        replaceCurrentSearch: () => {
          const view = viewRef.current;
          if (!view) return { current: 0, count: 0 };
          const query = getSearchQuery(view.state);
          const matches = getMatches(view, query);
          if (matches.length === 0) return { current: 0, count: 0 };

          const selection = view.state.selection.main;
          const selectedIndex = matches.findIndex(
            (match) => match.from === selection.from && match.to === selection.to,
          );
          const fallbackIndex = matches.findIndex((match) => match.from >= selection.head);
          const targetIndex =
            selectedIndex >= 0 ? selectedIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
          const target = matches[targetIndex];
          view.dispatch({
            changes: { from: target.from, to: target.to, insert: query.replace },
            selection: { anchor: target.from + query.replace.length },
            userEvent: "input.replace",
          });

          const nextMatches = getMatches(view);
          if (nextMatches.length > 0) {
            const nextIndex = nextMatches.findIndex(
              (match) => match.from >= target.from + query.replace.length,
            );
            selectSearchMatch(view, nextMatches[nextIndex >= 0 ? nextIndex : 0]);
          }
          return getCurrentSearchStatus(view);
        },

        replaceAllSearch: () => {
          const view = viewRef.current;
          if (!view) return { current: 0, count: 0 };
          const query = getSearchQuery(view.state);
          const matches = getMatches(view, query);
          if (matches.length === 0) return { current: 0, count: 0 };
          view.dispatch({
            changes: matches.map((match) => ({
              from: match.from,
              to: match.to,
              insert: query.replace,
            })),
            userEvent: "input.replace.all",
          });
          return getCurrentSearchStatus(view);
        },

        getSearchStatus: () => {
          const view = viewRef.current;
          return view ? getCurrentSearchStatus(view) : { current: 0, count: 0 };
        },

        subscribeSearchPanel: (listener) => {
          searchPanelListenersRef.current.add(listener);
          return () => searchPanelListenersRef.current.delete(listener);
        },

        subscribeSearchUpdate: (listener) => {
          searchUpdateListenersRef.current.add(listener);
          return () => searchUpdateListenersRef.current.delete(listener);
        },

        undo: () => {
          const view = viewRef.current;
          if (!view) return;
          undoCommand(view);
          view.focus();
        },

        redo: () => {
          const view = viewRef.current;
          if (!view) return;
          redoCommand(view);
          view.focus();
        },
      }),
      [],
    );

    return <div ref={hostRef} className="h-full overflow-hidden" />;
  },
);
