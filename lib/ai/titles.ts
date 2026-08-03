import type { ChatMessage } from "@/lib/ai/client";
import type { AiConfig } from "@/lib/ai/types";

/**
 * 起标题：一次拿回若干个候选，用户挑一个落回正文。
 *
 * 模型被要求「一行一个标题」，但各家模型总会自作主张加编号、引号或一句开场白，
 * 所以解析这一步按最宽松的方式来：能剥的装饰都剥掉，明显不是标题的行丢掉。
 */

/** 一次生成几个候选。 */
export const TITLE_SUGGESTION_COUNT = 5;

/** 单个标题的长度上限，超过的多半是模型把解释也写进来了。 */
const TITLE_MAX_LENGTH = 80;

export type TitleSource = "document" | "keywords";

export interface TitleRequestInput {
  source: TitleSource;
  /** 基于全文时是正文，基于关键词时是用户填的词或大纲。 */
  content: string;
  labels: {
    document: string;
    keywords: string;
  };
  count?: number;
}

/** 提示词里的 {{count}} 在请求时替换成实际条数。 */
export function buildTitleMessages(config: AiConfig, input: TitleRequestInput): ChatMessage[] {
  const count = input.count ?? TITLE_SUGGESTION_COUNT;
  const prompt = config.prompts.titles.replaceAll("{{count}}", String(count));
  const label = input.source === "keywords" ? input.labels.keywords : input.labels.document;
  return [
    { role: "system", content: prompt },
    { role: "user", content: `${label}\n\n${input.content}` },
  ];
}

/** 行首的编号、项目符号和 Markdown 标题记号。 */
const LEADING_MARKER = /^\s*(?:[-*+]\s+|\d{1,2}\s*[.、)）]\s*|#{1,6}\s+)/;
/** 成对的包裹符号：直引号、弯引号、书名号、方括号。 */
const WRAPPERS: Array<[string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
  ["《", "》"],
  ["「", "」"],
  ["『", "』"],
  ["【", "】"],
  ["[", "]"],
];

function stripWrappers(text: string): string {
  let value = text;
  for (;;) {
    const pair = WRAPPERS.find(([open, close]) => value.startsWith(open) && value.endsWith(close));
    if (!pair || value.length <= pair[0].length + pair[1].length) return value;
    value = value.slice(pair[0].length, value.length - pair[1].length).trim();
  }
}

/** 剥掉加粗和斜体这类残留的行内标记，标题本身用不上。 */
function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * 把模型返回的一段文字解析成候选列表。
 *
 * 只保留看起来像标题的行：剥完装饰后非空、不超长、不重复。宁可少给几个候选，
 * 也不要把「以下是 5 个标题：」这种话当成标题摆到用户面前。
 */
export function parseTitleCandidates(raw: string, limit = TITLE_SUGGESTION_COUNT): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const line of raw.split("\n")) {
    // 围栏和分隔线整行丢掉。
    if (/^\s*(?:```|~~~|-{3,}|_{3,}|\*{3,})/.test(line)) continue;

    const stripped = stripEmphasis(stripWrappers(line.replace(LEADING_MARKER, "").trim())).trim();
    if (!stripped) continue;
    // 结尾的冒号说明这行是「以下是几个标题：」之类的引导语。
    if (/[:：]$/.test(stripped)) continue;
    if (Array.from(stripped).length > TITLE_MAX_LENGTH) continue;

    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(stripped);
    if (titles.length >= limit) break;
  }

  return titles;
}
