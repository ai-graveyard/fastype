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

  it("标题与不可拆正文合计超页时一起缩放，不留下孤立标题或空页", () => {
    const pages = paginate([block(0, 200, "heading"), block(1, 900)], 1000);
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks.map((b) => b.blockIndex)).toEqual([0, 1]);
    expect(pages[0].overflow).toBe(true);
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

  it("不足一页的段落也会拆分填满剩余空间", () => {
    const pages = paginate(
      [block(0, 600), block(1, 600, "paragraph", [100, 100, 100, 100, 100, 100])],
      1000,
    );
    expect(pages[0].blocks[1].childRange).toEqual([0, 4]);
    expect(pages[1].blocks[0].childRange).toEqual([4, 6]);
  });

  it("首片段可以接在标题后，不把已有正文空置在上一页", () => {
    const pages = paginate(
      [
        block(0, 500),
        block(1, 100, "heading"),
        block(2, 1200, "list", [200, 200, 200, 200, 200, 200]),
      ],
      1000,
    );
    expect(pages[0].blocks.map((entry) => entry.blockIndex)).toEqual([0, 1, 2]);
    expect(pages[0].blocks[2].childRange).toEqual([0, 2]);
  });

  it("连续标题整体顺延，并重新计算首片段能容纳的高度", () => {
    const pages = paginate(
      [
        block(0, 750),
        block(1, 100, "heading"),
        block(2, 100, "heading"),
        block(3, 1600, "list", [400, 400, 400, 400]),
      ],
      1000,
    );
    expect(pages[0].blocks.map((entry) => entry.blockIndex)).toEqual([0]);
    expect(pages[1].blocks.map((entry) => entry.blockIndex)).toEqual([1, 2, 3]);
    expect(pages[1].blocks[2].childRange).toEqual([0, 2]);
    expect(pages.every((page) => !page.overflow)).toBe(true);
  });

  it("不生成只有重复表头的片段", () => {
    const table = { ...block(1, 700, "table", [100, 300, 300]), repeatChildren: [0] };
    const pages = paginate([block(0, 850), table], 1000);
    expect(pages[0].blocks).toEqual([{ blockIndex: 0 }]);
    expect(pages[1].blocks[0].childRange).toEqual([1, 3]);
  });

  it("按折叠间距计算，页首和页尾不计外边距", () => {
    const pages = paginate(
      [
        { ...block(0, 400), marginTop: 200, marginBottom: 100 },
        { ...block(1, 450), marginTop: 150, marginBottom: 200 },
      ],
      1000,
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].overflow).toBe(false);
  });

  it("图片可缩小三分之一以内以留在当前页", () => {
    const pages = paginate(
      [block(0, 550), { ...block(1, 600, "media"), media: { height: 600, maxScale: 4 / 3 } }],
      1000,
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks[1].imageScale).toBeCloseTo(0.75);
  });

  it("缩小三分之一仍放不下的图片换页，并限制放大幅度", () => {
    const pages = paginate(
      [block(0, 700), { ...block(1, 600, "media"), media: { height: 600, maxScale: 4 / 3 } }],
      1000,
    );
    expect(pages).toHaveLength(2);
    expect(pages[1].blocks[0].imageScale).toBeCloseTo(4 / 3);
  });

  it("放大页尾图片受可用宽度限制，后续正文保持顺序", () => {
    const pages = paginate(
      [{ ...block(0, 600, "media"), media: { height: 600, maxScale: 1.1 } }, block(1, 500)],
      1000,
    );
    expect(pages[0].blocks[0].imageScale).toBeCloseTo(1.1);
    expect(pages[1].blocks[0].blockIndex).toBe(1);
  });

  it("超高子项之后不插入空页、不重复或遗漏子项", () => {
    const pages = paginate([block(0, 2900, "list", [1200, 200, 1300, 200])], 1000);
    expect(pages.every((page) => page.blocks.length > 0)).toBe(true);
    expect(pages.flatMap((page) => page.blocks.map((entry) => entry.childRange))).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it("多种子项高度下，拆分首尾连续且正常页不超高", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const heights = Array.from(
        { length: 12 },
        (_, index) => 40 + ((seed * 79 + index * 131) % 1100),
      );
      const list = block(1, 30 + heights.reduce((a, b) => a + b, 0), "list", heights, 30);
      const pages = paginate([block(0, 350), list], 1000);
      const covered: number[] = [];
      for (const page of pages) {
        let height = 0;
        for (const entry of page.blocks) {
          if (entry.blockIndex === 0) height += 350;
          else {
            const [from, to] = entry.childRange!;
            height += 30 + heights.slice(from, to).reduce((a, b) => a + b, 0);
            covered.push(...Array.from({ length: to - from }, (_, index) => from + index));
          }
        }
        expect(page.overflow).toBe(height > 1000);
      }
      expect(covered).toEqual(heights.map((_, index) => index));
    }
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
