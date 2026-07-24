import { describe, expect, it } from "vitest";

import {
  parseXhsMarkdown,
  stringifyXhsMarkdown,
  suggestXhsMetadata,
  type XhsMetadata,
} from "@/lib/markdown/xhs-frontmatter";
import { XHS_LIMITS } from "@/lib/themes/xhs";

describe("小红书 Front Matter", () => {
  it("往返保留图片正文和内容正文元数据", () => {
    const body = "# 图片标题\n\n图片正文";
    const xhs: XhsMetadata = {
      title: "内容标题",
      content: "第一行\n第二行",
      tags: ["AI", "效率工具"],
    };

    const parsed = parseXhsMarkdown(stringifyXhsMarkdown(body, xhs));
    expect(parsed.body.trimEnd()).toBe(body);
    expect(parsed.xhs).toEqual(xhs);
  });

  it("保留其它 Front Matter 字段", () => {
    const source = "---\nauthor: FasType\nxhs:\n  title: 内容标题\n---\n# 图片正文\n";
    const parsed = parseXhsMarkdown(source);
    const updated = stringifyXhsMarkdown(parsed.body, parsed.xhs, parsed.otherData);

    expect(parseXhsMarkdown(updated).otherData).toEqual({ author: "FasType" });
    expect(parseXhsMarkdown(updated).xhs?.title).toBe("内容标题");
  });

  it("发布信息为空时不生成 Front Matter", () => {
    const body = "# 只有图片正文";
    const result = stringifyXhsMarkdown(body, { title: "", content: "", tags: [] });
    expect(result).toBe(body);
  });
});

describe("suggestXhsMetadata", () => {
  it("标题取第一个一级标题，正文取去除标题后的纯文本", () => {
    const suggestion = suggestXhsMetadata("# 我的标题\n\n第一段。\n\n第二段。");
    expect(suggestion.title).toBe("我的标题");
    expect(suggestion.content).not.toContain("我的标题");
    expect(suggestion.content).toContain("第一段。");
    expect(suggestion.content).toContain("第二段。");
  });

  it("没有一级标题时标题为空、正文仍取全部纯文本", () => {
    const suggestion = suggestXhsMetadata("只有一段普通正文。");
    expect(suggestion.title).toBe("");
    expect(suggestion.content).toBe("只有一段普通正文。");
  });

  it("跳过围栏代码块里的 # 号", () => {
    const suggestion = suggestXhsMetadata("```\n# 不是标题\n```\n\n# 真正的标题\n\n正文");
    expect(suggestion.title).toBe("真正的标题");
  });

  it("正文超过 1000 字时按字符截断", () => {
    const longBody = `# 标题\n\n${"字".repeat(2000)}`;
    const suggestion = suggestXhsMetadata(longBody);
    expect(Array.from(suggestion.content).length).toBe(XHS_LIMITS.contentBody);
  });
});
