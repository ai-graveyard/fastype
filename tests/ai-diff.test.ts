import { describe, expect, it } from "vitest";

import { computeDiffSegments, diffStats } from "@/lib/ai/diff";

function reconstructOriginal(segments: ReturnType<typeof computeDiffSegments>): string {
  return segments
    .filter((segment) => segment.type !== "add")
    .map((segment) => segment.value)
    .join("");
}

function reconstructResult(segments: ReturnType<typeof computeDiffSegments>): string {
  return segments
    .filter((segment) => segment.type !== "remove")
    .map((segment) => segment.value)
    .join("");
}

describe("computeDiffSegments", () => {
  it("完全相同的文本只产生 equal 片段", () => {
    const segments = computeDiffSegments("hello world", "hello world");
    expect(segments.every((segment) => segment.type === "equal")).toBe(true);
  });

  it("原文为空时整段结果都是新增", () => {
    const segments = computeDiffSegments("", "hello");
    expect(segments).toEqual([{ type: "add", value: "hello" }]);
  });

  it("结果为空时整段原文都是删除", () => {
    const segments = computeDiffSegments("hello", "");
    expect(segments).toEqual([{ type: "remove", value: "hello" }]);
  });

  it("能从片段中还原出原文和结果", () => {
    const original = "这是一个测试文档，包含一些内容。";
    const result = "这是一份测试稿件，包含一些信息。";
    const segments = computeDiffSegments(original, result);
    expect(reconstructOriginal(segments)).toBe(original);
    expect(reconstructResult(segments)).toBe(result);
    expect(segments.some((segment) => segment.type === "add")).toBe(true);
    expect(segments.some((segment) => segment.type === "remove")).toBe(true);
  });
});

describe("diffStats", () => {
  it("统计新增和删除的字符数", () => {
    const segments = computeDiffSegments("hello world", "hello there");
    const stats = diffStats(segments);
    expect(stats.added).toBeGreaterThan(0);
    expect(stats.removed).toBeGreaterThan(0);
  });

  it("没有变化时新增和删除都是 0", () => {
    const segments = computeDiffSegments("same text", "same text");
    expect(diffStats(segments)).toEqual({ added: 0, removed: 0 });
  });
});
