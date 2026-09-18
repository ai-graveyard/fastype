import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetRichCachesForTests,
  readDiagramCache,
  readHighlightCache,
  writeDiagramCache,
  writeHighlightCache,
} from "@/lib/markdown/rich-cache";

describe("富内容缓存", () => {
  beforeEach(() => {
    __resetRichCachesForTests();
  });

  it("高亮缓存满后只淘汰最久未使用项", () => {
    for (let index = 0; index < 64; index += 1) {
      writeHighlightCache(`key-${index}`, `value-${index}`);
    }

    expect(readHighlightCache("key-0")).toBe("value-0");
    writeHighlightCache("key-64", "value-64");

    expect(readHighlightCache("key-0")).toBe("value-0");
    expect(readHighlightCache("key-1")).toBeUndefined();
    expect(readHighlightCache("key-2")).toBe("value-2");
    expect(readHighlightCache("key-64")).toBe("value-64");
  });

  it("图表缓存更新已有项不会误淘汰其他项", () => {
    for (let index = 0; index < 64; index += 1) {
      writeDiagramCache(`key-${index}`, { html: `html-${index}`, style: `style-${index}` });
    }

    writeDiagramCache("key-0", { html: "updated", style: "updated-style" });

    expect(readDiagramCache("key-0")).toEqual({ html: "updated", style: "updated-style" });
    expect(readDiagramCache("key-1")).toEqual({ html: "html-1", style: "style-1" });
  });
});
