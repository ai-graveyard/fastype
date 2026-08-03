/**
 * 一级标题的读写。
 *
 * 起标题功能拿到候选之后要落回正文，落点只有一个：Markdown 里的第一个 H1。
 * 没有 H1 时补一个，位置在 Front Matter 之后、正文最前面。
 */

const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const H1_PATTERN = /^\s{0,3}#\s+.*$/;
/** Front Matter 结尾那一行；和 lib/markdown/front-matter.ts 的切分口径一致。 */
const FRONT_MATTER_START = /^﻿?---[ \t]*$/;
const FRONT_MATTER_END = /^---[ \t]*$/;

/** 一行文字里的换行和多余空白都会破坏 `# 标题` 这一行，写回前统一压平。 */
export function normalizeTitleText(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

/** Front Matter 占掉的行数；没有就是 0。 */
function frontMatterLineCount(lines: string[]): number {
  if (lines.length === 0 || !FRONT_MATTER_START.test(lines[0])) return 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (FRONT_MATTER_END.test(lines[index])) return index + 1;
  }
  // 没有闭合就当它不是 Front Matter，整篇都是正文。
  return 0;
}

/** 第一个 H1 的行号；围栏代码块里的 `#` 是注释，不算标题。返回 -1 表示没有。 */
export function findH1Line(source: string): number {
  const lines = source.split("\n");
  let fence: string | null = null;
  for (let index = frontMatterLineCount(lines); index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = FENCE_PATTERN.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1][0] === fence[0]) fence = null;
      continue;
    }
    if (fence) continue;
    if (H1_PATTERN.test(line)) return index;
  }
  return -1;
}

/**
 * 把标题写进正文：有 H1 就替换那一行，没有就在 Front Matter 之后插入一个。
 * 除了这一行，正文其它内容一个字都不动。
 */
export function applyTitleToSource(source: string, title: string): string {
  const normalized = normalizeTitleText(title);
  if (!normalized) return source;

  const lines = source.split("\n");
  const h1Line = findH1Line(source);
  if (h1Line >= 0) {
    lines[h1Line] = `# ${normalized}`;
    return lines.join("\n");
  }

  const insertAt = frontMatterLineCount(lines);
  // 插入的标题和后面的正文之间留一个空行；正文本来就以空行开头时不再多加。
  const followedByBlank = (lines[insertAt] ?? "").trim() === "";
  lines.splice(insertAt, 0, `# ${normalized}`, ...(followedByBlank ? [] : [""]));
  return lines.join("\n");
}
