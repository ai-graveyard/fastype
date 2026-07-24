import { diffWords } from "diff";

export type DiffSegmentType = "equal" | "add" | "remove";

export interface DiffSegment {
  type: DiffSegmentType;
  value: string;
}

export interface DiffStats {
  added: number;
  removed: number;
}

/**
 * 用 Intl.Segmenter 做词级分词，中文也能按词而不是按字对比；
 * 环境不支持时（如极老浏览器）自动退回 jsdiff 内置的正则分词。
 */
function wordSegmenter(): Intl.Segmenter | undefined {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return undefined;
  try {
    return new Intl.Segmenter(undefined, { granularity: "word" });
  } catch {
    return undefined;
  }
}

export function computeDiffSegments(original: string, result: string): DiffSegment[] {
  const intlSegmenter = wordSegmenter();
  const changes = diffWords(original, result, intlSegmenter ? { intlSegmenter } : undefined);
  return changes.map((change) => ({
    type: change.added ? "add" : change.removed ? "remove" : "equal",
    value: change.value,
  }));
}

export function diffStats(segments: DiffSegment[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const segment of segments) {
    if (segment.type === "add") added += segment.value.length;
    else if (segment.type === "remove") removed += segment.value.length;
  }
  return { added, removed };
}
