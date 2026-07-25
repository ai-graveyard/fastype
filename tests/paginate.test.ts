import { describe, expect, it } from "vitest";

import { blockKindOf, paginate, type MeasuredBlock } from "@/lib/markdown/paginate";

function block(
  index: number,
  height: number,
  kind: MeasuredBlock["kind"] = "paragraph",
  children?: number[],
  chrome = 0,
): MeasuredBlock {
  return {
    index,
    height,
    kind,
    chrome,
    children: children?.map((h, i) => ({ index: i, height: h })),
  };
}

describe("paginate", () => {
  it("空输入仍保留一张可预览和导出的空白页", () => {
    expect(paginate([], 1000)).toEqual([{ blocks: [], overflow: false }]);
  });

  it("放得下就放在同一页", () => {
    const pages = paginate([block(0, 300), block(1, 300), block(2, 300)], 1000);
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks.map((b) => b.blockIndex)).toEqual([0, 1, 2]);
  });

  it("放不下就换页，且不会静默丢块", () => {
    const pages = paginate([block(0, 600), block(1, 600), block(2, 600)], 1000);
    expect(pages).toHaveLength(3);
    const placed = pages.flatMap((page) => page.blocks.map((b) => b.blockIndex));
    expect(placed).toEqual([0, 1, 2]);
  });

  it("页尾的孤儿标题顺延到下一页", () => {
    // 正文 500 + 标题 200 = 700，下一段 400 放不下，标题应该跟着走。
    const pages = paginate([block(0, 500), block(1, 200, "heading"), block(2, 400)], 1000);
    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((b) => b.blockIndex)).toEqual([0]);
    expect(pages[1].blocks.map((b) => b.blockIndex)).toEqual([1, 2]);
  });

  it("只有标题一个块时不会被顺延成空页", () => {
    const pages = paginate([block(0, 200, "heading"), block(1, 900)], 1000);
    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((b) => b.blockIndex)).toEqual([0]);
  });

  it("超高的列表按子项拆到多页", () => {
    const list = block(0, 1500, "list", [500, 500, 500]);
    const pages = paginate([list], 1000);
    expect(pages.length).toBeGreaterThan(1);
    // 拆出来的片段必须首尾相接，不能漏掉子项。
    const ranges = pages.flatMap((page) => page.blocks.map((b) => b.childRange ?? [0, 3]));
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(3);
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i][0]).toBe(ranges[i - 1][1]);
    }
  });

  it("拆分时每个片段都重复承担容器开销", () => {
    // chrome=100，一页 1000，子项各 450：一页只能放一个子项（100+450+450=1000 正好放两个）
    const pages = paginate([block(0, 1000, "code", [450, 450], 100)], 1000);
    expect(pages).toHaveLength(1);

    const tighter = paginate([block(0, 1200, "code", [500, 500, 100], 100)], 1000);
    expect(tighter.length).toBeGreaterThan(1);
  });

  it("既放不下又拆不开的块单独成页并标记 overflow", () => {
    const pages = paginate([block(0, 2000, "media")], 1000);
    expect(pages).toHaveLength(1);
    expect(pages[0].overflow).toBe(true);
    expect(pages[0].blocks[0].blockIndex).toBe(0);
  });

  it("单个子项超过一整页时也会被标记，而不是裁掉", () => {
    const pages = paginate([block(0, 3000, "code", [2500, 300], 0)], 1000);
    expect(pages.some((page) => page.overflow)).toBe(true);
    const covered = pages.flatMap((page) =>
      page.blocks.flatMap((b) => (b.childRange ? [b.childRange] : [])),
    );
    expect(covered[0][0]).toBe(0);
  });

  it("页高非法时退化为单页而不是崩溃", () => {
    const pages = paginate([block(0, 100), block(1, 100)], 0);
    expect(pages).toHaveLength(1);
    expect(pages[0].overflow).toBe(true);
  });
});

describe("blockKindOf", () => {
  it("按标签识别块类型", () => {
    expect(blockKindOf("H2")).toBe("heading");
    expect(blockKindOf("p")).toBe("paragraph");
    expect(blockKindOf("UL")).toBe("list");
    expect(blockKindOf("pre")).toBe("code");
    expect(blockKindOf("table")).toBe("table");
    expect(blockKindOf("img")).toBe("media");
    expect(blockKindOf("div")).toBe("other");
  });
});
