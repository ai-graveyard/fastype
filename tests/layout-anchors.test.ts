import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown/parse";
import { applyLayoutBreaks, layoutBlocks } from "@/lib/markdown/layout-anchors";
import { paginate } from "@/lib/markdown/paginate";
import { applyXhsHeadingNumbers } from "@/lib/render/xhs";
import { DEFAULT_XHS_STYLE } from "@/lib/themes/xhs";

describe("手动分页", () => {
  it("前方插入内容后分页仍跟随原块，正文不含排版标记", () => {
    const original = "# 标题\n\n第一段\n\n## 第二节\n\n第二段";
    const blocks = layoutBlocks(renderMarkdown(original).html, original);
    const key = blocks[2].key;
    const next = "新增内容\n\n" + original;
    const html = renderMarkdown(next).html;
    const updated = layoutBlocks(html, next);
    expect(updated.find((block) => block.key === key)?.label).toBe("第二节");
    const marked = applyLayoutBreaks(html, updated, [key]);
    expect(marked).toMatch(/<h2[^>]*data-page-break-before="true"/);
    expect(next).not.toContain("data-page-break");
    const numbered = applyXhsHeadingNumbers(marked, {
      ...DEFAULT_XHS_STYLE,
      headings: {
        ...DEFAULT_XHS_STYLE.headings,
        h2: {
          ...DEFAULT_XHS_STYLE.headings.h2,
          number: { ...DEFAULT_XHS_STYLE.headings.h2.number, enabled: true },
        },
      },
    });
    expect(numbered).toContain('data-page-break-before="true"');
  });
  it("重复块和已改动块不误应用旧分页规则", () => {
    const source = "相同段落\n\n相同段落";
    expect(layoutBlocks(renderMarkdown(source).html, source)).toHaveLength(0);
  });
  it("显式换页不会丢块，也不会生成空白页", () => {
    const pages = paginate(
      [
        { index: 0, kind: "paragraph", height: 20, breakBefore: true },
        { index: 1, kind: "heading", height: 10, breakBefore: true },
        { index: 2, kind: "paragraph", height: 20 },
      ],
      100,
    );
    expect(pages.map((page) => page.blocks.map((block) => block.blockIndex))).toEqual([
      [0],
      [1, 2],
    ]);
  });
  it("可切换标题与下一段保持同页", () => {
    const blocks = [
      { index: 0, kind: "paragraph" as const, height: 65 },
      { index: 1, kind: "heading" as const, height: 20 },
      { index: 2, kind: "paragraph" as const, height: 30 },
    ];
    expect(
      paginate(blocks, 100).map((page) => page.blocks.map((block) => block.blockIndex)),
    ).toEqual([[0], [1, 2]]);
    expect(
      paginate(blocks, 100, false).map((page) => page.blocks.map((block) => block.blockIndex)),
    ).toEqual([[0, 1], [2]]);
  });
});
