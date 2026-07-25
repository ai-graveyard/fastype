import { describe, expect, it } from "vitest";

import { parseFrontMatter, stringifyFrontMatter } from "@/lib/markdown/front-matter";

describe("parseFrontMatter", () => {
  it("切出 Front Matter 与正文", () => {
    const parsed = parseFrontMatter("---\nauthor: FasType\n---\n# 标题\n\n正文\n");
    expect(parsed.data).toEqual({ author: "FasType" });
    expect(parsed.content).toBe("# 标题\n\n正文\n");
  });

  it("没有 Front Matter 时整篇都是正文", () => {
    const source = "# 标题\n\n正文";
    expect(parseFrontMatter(source)).toEqual({ data: {}, content: source });
  });

  it("正文中间的 --- 不当作 Front Matter", () => {
    const source = "# 标题\n\n---\n\n分隔线下面的正文";
    expect(parseFrontMatter(source)).toEqual({ data: {}, content: source });
  });

  it("空 Front Matter 不吞正文", () => {
    const parsed = parseFrontMatter("---\n---\n正文");
    expect(parsed.data).toEqual({});
    expect(parsed.content).toBe("正文");
  });

  it("支持 CRLF 与 BOM", () => {
    const parsed = parseFrontMatter("﻿---\r\nauthor: FasType\r\n---\r\n正文");
    expect(parsed.data).toEqual({ author: "FasType" });
    expect(parsed.content).toBe("正文");
  });

  it("Front Matter 不是映射时按没有元数据处理，正文不丢", () => {
    const parsed = parseFrontMatter("---\n- 一\n- 二\n---\n正文");
    expect(parsed.data).toEqual({});
    expect(parsed.content).toBe("正文");
  });

  it("YAML 损坏时抛出，由调用方决定如何兜底", () => {
    expect(() => parseFrontMatter("---\na: [1,\n---\n正文")).toThrow();
  });
});

describe("stringifyFrontMatter", () => {
  it("数据为空时不写分隔符", () => {
    expect(stringifyFrontMatter("正文", {})).toBe("正文");
  });

  it("往返保持数据不变", () => {
    const data = { author: "FasType", xhs: { title: "标题", tags: ["AI", "效率工具"] } };
    expect(parseFrontMatter(stringifyFrontMatter("正文", data)).data).toEqual(data);
  });

  it("长字符串不折行", () => {
    const long = "字".repeat(200);
    const output = stringifyFrontMatter("正文", { content: long });
    expect(output.split("\n").some((line) => line.includes(long))).toBe(true);
    expect(parseFrontMatter(output).data).toEqual({ content: long });
  });
});
