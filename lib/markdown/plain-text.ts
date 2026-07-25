import { parseFrontMatter } from "@/lib/markdown/front-matter";

/**
 * Markdown → 纯文本，供编辑器的「复制纯文本」用。
 *
 * 不走 renderMarkdown：那条路要 DOM，且 textContent 会把段落挤成一坨，
 * 粘到公众号后台或备忘录里全是连成一片的文字。这里按行处理，保留段落、
 * 缩进和换行，只把 Markdown 标记去掉。
 */

const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const THEMATIC_BREAK_PATTERN = /^\s{0,3}(?:-{3,}|_{3,}|\*{3,}|={2,})[\s\-_*=]*$/;
const LINK_DEFINITION_PATTERN = /^\s{0,3}\[[^\]]+]:\s*\S+/;
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;

/**
 * 反斜杠转义的字符先藏进私有区占位符，等所有标记都剥完再还原；
 * 否则 `\*不含税\*` 里的两个星号会被当成一对斜体标记消掉。
 */
const ESCAPE_OPEN = String.fromCharCode(0xe000);
const ESCAPE_CLOSE = String.fromCharCode(0xe001);
const MASKED_ESCAPE_PATTERN = new RegExp(`${ESCAPE_OPEN}(\\d+)${ESCAPE_CLOSE}`, "g");

function maskEscapes(text: string): string {
  return text.replace(
    /\\([\\`*_{}[\]()#+\-.!>~|])/g,
    (_match, char: string) => `${ESCAPE_OPEN}${char.charCodeAt(0)}${ESCAPE_CLOSE}`,
  );
}

function unmaskEscapes(text: string): string {
  return text.replace(MASKED_ESCAPE_PATTERN, (_match, code: string) =>
    String.fromCharCode(Number(code)),
  );
}

/** GFM 表格的分隔行，例如 `| --- | :---: |`，纯文本里没有对应物，整行丢掉。 */
function isTableDelimiterRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

/** 表格行拆成单元格，转义过的 `\|` 不算分隔符。 */
function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (const char of trimmed) {
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

function stripInline(text: string): string {
  return (
    text
      .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
      .replace(/!\[([^\]]*)]\[[^\]]*]/g, "$1")
      .replace(/\[([^\]]*)]\[[^\]]*]/g, "$1")
      // 自动链接要在剥 HTML 标签之前处理，否则 <https://…> 会被当成标签整段删掉。
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, "$1")
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
      .replace(/`+([^`]*)`+/g, "$1")
      .replace(/\*\*\*([^\s*](?:[^*]*[^\s*])?)\*\*\*/g, "$1")
      .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, "$1")
      .replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, "$1")
      // 下划线只在词边界上算强调，snake_case 的变量名不能被拆开。
      .replace(/(^|[^\w\\])__([^\s_](?:[^_]*[^\s_])?)__(?!\w)/g, "$1$2")
      .replace(/(^|[^\w\\])_([^\s_](?:[^_]*[^\s_])?)_(?!\w)/g, "$1$2")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/[ \t]+$/, "")
  );
}

export function markdownToPlainText(source: string): string {
  if (!source.trim()) return "";

  let body = source;
  try {
    body = parseFrontMatter(source).content;
  } catch {
    // Front Matter 里的 YAML 坏了就当没有，宁可多复制几行也不能吞掉正文。
  }

  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const fenceMatch = FENCE_PATTERN.exec(line);

    if (fence) {
      // 围栏内是代码，原样保留，只在遇到闭合围栏时收尾。
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = null;
      } else {
        output.push(line);
      }
      continue;
    }

    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }

    if (THEMATIC_BREAK_PATTERN.test(line)) {
      output.push("");
      continue;
    }
    if (isTableDelimiterRow(line) || LINK_DEFINITION_PATTERN.test(line)) continue;

    let text = maskEscapes(line)
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s*(?:>\s?)+/, "")
      .replace(/^(\s*)(?:[-+*]|\d+[.)])\s+/, "$1")
      .replace(/^(\s*)\[[ xX]]\s+/, "$1");

    // 只认两侧带竖线的表格行，正文里偶尔出现的 `a | b` 不该被当成表格拆开。
    if (TABLE_ROW_PATTERN.test(text)) {
      const cells = splitTableRow(text);
      if (cells.length > 1) text = cells.map(stripInline).join("\t");
    }

    output.push(stripInline(text));
  }

  return unmaskEscapes(output.join("\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
