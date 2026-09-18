/**
 * 正文里的图片引用。
 *
 * 图片本体存在 IndexedDB 里（lib/image/db.ts），Markdown 源码中只留一个引用：
 *
 * ```markdown
 * ![说明](fastype-img:9f3ac2d18b40e517)
 * ```
 *
 * 换掉原来的「base64 直接写进正文」是因为 localStorage 装不下：一份配额只有 5 MB，
 * 而且按 UTF-16 计量，base64 再涨三分之一，两三张手机照片就把草稿顶爆。引用只有
 * 二十几个字符，草稿回到几十 KB，自动保存也不用每 3 秒往 localStorage 里塞几兆。
 *
 * 引用只在编辑期间有效，落到磁盘上的东西一律换回 data URI（见 lib/image/library.ts
 * 的 inlineImageRefs）——「一篇 Markdown，写完就能带走」这句话不能因为换了存储就失效。
 */

/** 引用前缀。用 `fastype-img:` 而不是 `blob:`：blob 地址活不过这次会话。 */
export const IMAGE_REF_SCHEME = "fastype-img:";

/** id 固定 16 位小写十六进制，模式才能咬得紧，不会把后面的正文一起吞进来。 */
const ID_LENGTH = 16;
const REF_SOURCE = `${IMAGE_REF_SCHEME}([0-9a-f]{${ID_LENGTH}})`;

/** 每次都新建：带 `g` 的正则有 lastIndex，跨调用共用一个迟早出错。 */
export function imageRefPattern(): RegExp {
  return new RegExp(REF_SOURCE, "g");
}

/** 64 位随机数，够一篇文档里的几十张图不撞。 */
export function newImageId(): string {
  const bytes = new Uint8Array(ID_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildImageRef(id: string): string {
  return `${IMAGE_REF_SCHEME}${id}`;
}

/** 整个 src 就是一条引用时返回它的 id，其它情况（外链、data URI）返回 null。 */
export function imageRefId(src: string): string | null {
  const match = new RegExp(`^${REF_SOURCE}$`).exec(src.trim());
  return match ? match[1] : null;
}

/** 整个值就是一条引用（设置里的头像、封面字段就是这种形态）。 */
export function isImageRef(src: string): boolean {
  return imageRefId(src) !== null;
}

export interface MarkdownImageTarget {
  value: string;
  start: number;
  end: number;
}

function escapedAt(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function closingBracket(source: string, start: number): number {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    if (escapedAt(source, cursor)) continue;
    if (source[cursor] === "[") depth += 1;
    if (source[cursor] !== "]") continue;
    if (depth === 0) return cursor;
    depth -= 1;
  }
  return -1;
}

function closingDestination(source: string, start: number): number {
  let depth = 0;
  let quote = "";
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (escapedAt(source, cursor)) continue;
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char !== ")") continue;
    if (depth === 0) return cursor;
    depth -= 1;
  }
  return -1;
}

function imageTargetAt(source: string, imageStart: number): MarkdownImageTarget | null {
  const altEnd = closingBracket(source, imageStart + 2);
  if (altEnd < 0 || source[altEnd + 1] !== "(") return null;

  let start = altEnd + 2;
  while (source[start] === " " || source[start] === "\t") start += 1;
  if (start >= source.length) return null;

  let end = start;
  if (source[start] === "<") {
    start += 1;
    end = start;
    while (end < source.length && (source[end] !== ">" || escapedAt(source, end))) end += 1;
    if (end >= source.length) return null;
    if (closingDestination(source, end + 1) < 0) return null;
  } else {
    let depth = 0;
    while (end < source.length) {
      const char = source[end];
      if (escapedAt(source, end)) {
        end += 1;
        continue;
      }
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        if (depth === 0) break;
        depth -= 1;
      } else if ((char === " " || char === "\t") && depth === 0) {
        break;
      }
      end += 1;
    }
    if (end === start || closingDestination(source, end) < 0) return null;
  }

  return { value: source.slice(start, end), start, end };
}

function scanLine(line: string, offset: number, targets: MarkdownImageTarget[]): void {
  for (let cursor = 0; cursor < line.length; cursor += 1) {
    if (line[cursor] === "`" && !escapedAt(line, cursor)) {
      let end = cursor + 1;
      while (line[end] === "`") end += 1;
      const delimiter = line.slice(cursor, end);
      const closing = line.indexOf(delimiter, end);
      if (closing < 0) return;
      cursor = closing + delimiter.length - 1;
      continue;
    }
    if (line[cursor] !== "!" || line[cursor + 1] !== "[" || escapedAt(line, cursor)) {
      continue;
    }
    const target = imageTargetAt(line, cursor);
    if (!target) continue;
    targets.push({
      value: target.value,
      start: offset + target.start,
      end: offset + target.end,
    });
    cursor = target.end;
  }
}

/** 找出代码之外的 Markdown 图片目标；不解析普通链接、HTML 图片或裸文本。 */
export function findMarkdownImageTargets(source: string): MarkdownImageTarget[] {
  const targets: MarkdownImageTarget[] = [];
  let offset = 0;
  let fence: { marker: string; length: number } | null = null;

  for (const lineWithBreak of source.match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!lineWithBreak) continue;
    const line = lineWithBreak.endsWith("\n") ? lineWithBreak.slice(0, -1) : lineWithBreak;
    const marker = /^(?: {0,3})(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (
        marker?.[0] === fence.marker &&
        marker.length >= fence.length &&
        line.slice(line.indexOf(marker) + marker.length).trim() === ""
      ) {
        fence = null;
      }
    } else if (marker) {
      fence = { marker: marker[0], length: marker.length };
    } else if (!/^(?: {4}|\t)/.test(line)) {
      scanLine(line, offset, targets);
    }
    offset += lineWithBreak.length;
  }
  return targets;
}

/** 只替换 Markdown 图片目标，代码与普通文字里的相同字符串保持原样。 */
export function replaceMarkdownImageTargets(
  source: string,
  resolve: (target: string) => string | null,
): string {
  const targets = findMarkdownImageTargets(source);
  if (targets.length === 0) return source;

  let cursor = 0;
  let result = "";
  for (const target of targets) {
    result += source.slice(cursor, target.start);
    result += resolve(target.value) ?? target.value;
    cursor = target.end;
  }
  return result + source.slice(cursor);
}

/** 正文图片目标里出现过的 id，去重后按出现顺序。 */
export function findImageRefIds(source: string): string[] {
  const ids: string[] = [];
  for (const target of findMarkdownImageTargets(source)) {
    const id = imageRefId(target.value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * 逐条替换正文里的引用。
 *
 * `resolve` 返回 null 表示这张图现在换不出来，原样留着——留着的引用渲染时会被消毒层
 * 剥掉 src，正好落进「图片加载失败」那套既有提示里，比悄悄换成空白更容易发现问题。
 */
export function replaceImageRefs(source: string, resolve: (id: string) => string | null): string {
  return replaceMarkdownImageTargets(source, (target) => {
    const id = imageRefId(target);
    return id ? resolve(id) : null;
  });
}
