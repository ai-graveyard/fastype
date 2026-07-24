import matter from "gray-matter";

import { XHS_INPUT_LIMITS, XHS_LIMITS } from "@/lib/themes/xhs";

import { extractTitleFromSource, renderMarkdown } from "./parse";

/** 小红书发布时独立于图片正文保存的纯文本信息。 */
export interface XhsMetadata {
  title: string;
  content: string;
  tags: string[];
}

export interface ParsedXhsContent {
  /** 用于图片排版和其它平台渲染的 Markdown 正文。 */
  body: string;
  xhs: XhsMetadata | null;
  /** 保留不属于 FasType 的 Front Matter 数据。 */
  otherData: Record<string, unknown>;
}

export const DEFAULT_XHS_METADATA: XhsMetadata = {
  title: "",
  content: "",
  tags: [],
};

/** 将 Markdown 的图片正文与小红书发布元数据分开。 */
export function parseXhsMarkdown(markdown: string): ParsedXhsContent {
  try {
    const parsed = matter(markdown);
    const data = parsed.data as Record<string, unknown>;
    const xhsData = data.xhs;
    let xhs: XhsMetadata | null = null;

    if (xhsData && typeof xhsData === "object" && !Array.isArray(xhsData)) {
      const input = xhsData as Record<string, unknown>;
      xhs = {
        title: typeof input.title === "string" ? input.title : "",
        content: typeof input.content === "string" ? input.content : "",
        tags: Array.isArray(input.tags)
          ? input.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
      };
    }

    const otherData = { ...data };
    delete otherData.xhs;
    return { body: parsed.content, xhs, otherData };
  } catch {
    // Front Matter 损坏时不丢正文，让用户仍能在编辑器里自行修复原文。
    return { body: markdown, xhs: null, otherData: {} };
  }
}

/** 把发布元数据写回 Markdown；三项都为空时不生成多余的 Front Matter。 */
export function stringifyXhsMarkdown(
  body: string,
  xhs: XhsMetadata | null,
  otherData: Record<string, unknown> = {},
): string {
  const normalizedTags = xhs?.tags.map((tag) => tag.trim()).filter(Boolean) ?? [];
  const hasXhsData = Boolean(xhs && (xhs.title || xhs.content || normalizedTags.length));
  const data: Record<string, unknown> = { ...otherData };

  if (hasXhsData && xhs) {
    data.xhs = {
      ...(xhs.title ? { title: xhs.title } : {}),
      ...(xhs.content ? { content: xhs.content } : {}),
      ...(normalizedTags.length ? { tags: normalizedTags } : {}),
    };
  }

  return Object.keys(data).length ? matter.stringify(body, data) : body;
}

/** 去掉正文里第一个一级标题所在行；跳过围栏代码块的逻辑与 extractTitleFromSource 保持一致。 */
function removeFirstHeadingLine(source: string): string {
  let inFence = false;
  let fenceMarker = "";
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const fence = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    if (/^\s{0,3}#\s+.+$/.test(lines[i])) {
      lines.splice(i, 1);
      break;
    }
  }

  return lines.join("\n");
}

function clampByCodePoints(text: string, limit: number): string {
  const chars = Array.from(text);
  return chars.length > limit ? chars.slice(0, limit).join("") : text;
}

/**
 * 从图片正文推导小红书笔记内容的建议值：标题取第一个一级标题，正文取去除该标题后的
 * 纯文本前若干字，均按平台字数上限截断（PRD 3「内容与样式分离」——建议值仍需用户确认后写入）。
 */
export function suggestXhsMetadata(
  body: string,
): Pick<XhsMetadata, "title" | "content"> {
  const title = extractTitleFromSource(body) ?? "";
  const plainText = renderMarkdown(removeFirstHeadingLine(body)).text;

  return {
    title: clampByCodePoints(title, XHS_INPUT_LIMITS.contentTitle),
    content: clampByCodePoints(plainText, XHS_LIMITS.contentBody),
  };
}
