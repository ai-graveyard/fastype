import { dump, load } from "js-yaml";

/**
 * 只做 YAML Front Matter 的切分与拼装。
 *
 * 这里没有用 gray-matter：它为了支持 JS / CoffeeScript 等 Front Matter 引擎会静态引入
 * esprima，而本项目只需要 YAML 一种，那部分体积（连同 js-yaml 的旧版本）全是白付的。
 */

export interface FrontMatterDocument {
  data: Record<string, unknown>;
  content: string;
}

/** 开头的 `---` 到下一个独占一行的 `---` 之间即 Front Matter；允许 BOM 和 CRLF。 */
const FRONT_MATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 切出 Front Matter 与正文。没有 Front Matter、或它不是一个 YAML 映射时，
 * 整篇都算正文——宁可当作没有元数据，也不能把正文吞掉。
 */
export function parseFrontMatter(source: string): FrontMatterDocument {
  const match = FRONT_MATTER_PATTERN.exec(source);
  if (!match) return { data: {}, content: source };

  const content = source.slice(match[0].length);
  // js-yaml 对空输入是抛异常而不是返回空，空的 Front Matter 不该被当成损坏。
  if (!match[1].trim()) return { data: {}, content };

  const parsed = load(match[1]);
  return isPlainObject(parsed) ? { data: parsed, content } : { data: {}, content };
}

/** 拼回 `---` 包裹的 Front Matter；数据为空时不写分隔符。 */
export function stringifyFrontMatter(content: string, data: Record<string, unknown>): string {
  if (!Object.keys(data).length) return content;
  // 不折行：正文元数据可能很长，折行后用户在编辑器里看到的 YAML 会莫名其妙地断开。
  const yaml = dump(data, { lineWidth: -1 });
  return `---\n${yaml}---\n${content}`;
}
