import { describe, expect, it } from "vitest";

import { markdownToPlainText } from "@/lib/markdown/plain-text";

describe("markdownToPlainText", () => {
  it("去掉标题、强调和行内代码的标记", () => {
    expect(markdownToPlainText("## 小标题")).toBe("小标题");
    expect(markdownToPlainText("**粗** *斜* ***都有*** ~~删~~ `code`")).toBe("粗 斜 都有 删 code");
    expect(markdownToPlainText("__粗__ 和 _斜_")).toBe("粗 和 斜");
  });

  it("不拆开 snake_case 变量名", () => {
    expect(markdownToPlainText("变量 foo_bar_baz 保持原样")).toBe("变量 foo_bar_baz 保持原样");
  });

  it("链接留文字，图片留描述", () => {
    expect(markdownToPlainText("看 [文档](https://example.com) 和 ![封面](/a.png)")).toBe(
      "看 文档 和 封面",
    );
    expect(markdownToPlainText("<https://example.com>")).toBe("https://example.com");
  });

  it("列表和引用只去标记，保留缩进与层级", () => {
    expect(markdownToPlainText("- a\n- b\n  - c\n\n1. 一\n2. 二")).toBe("a\nb\n  c\n\n一\n二");
    expect(markdownToPlainText("> 引用\n> > 套娃")).toBe("引用\n套娃");
    expect(markdownToPlainText("- [ ] 待办\n- [x] 已完成")).toBe("待办\n已完成");
  });

  it("围栏代码块保留代码本身，去掉围栏", () => {
    expect(markdownToPlainText("```ts\nconst a = **1**;\n```")).toBe("const a = **1**;");
  });

  it("表格去掉分隔行，单元格用制表符隔开", () => {
    expect(markdownToPlainText("| A | B |\n| --- | --- |\n| 1 | 2 |")).toBe("A\tB\n1\t2");
  });

  it("正文里的竖线不当成表格", () => {
    expect(markdownToPlainText("命令是 ls | grep a")).toBe("命令是 ls | grep a");
  });

  it("丢掉 Front Matter、分割线和链接定义", () => {
    expect(markdownToPlainText("---\ntitle: 标题\n---\n\n正文")).toBe("正文");
    expect(markdownToPlainText("上\n\n---\n\n下")).toBe("上\n\n下");
    expect(markdownToPlainText("正文\n\n[ref]: https://example.com")).toBe("正文");
  });

  it("保留段落之间的空行，但不留三连空行", () => {
    expect(markdownToPlainText("# 标题\n\n\n\n正文")).toBe("标题\n\n正文");
  });

  it("剥掉内嵌 HTML 标签，保留文字", () => {
    expect(markdownToPlainText("<div>正文</div>")).toBe("正文");
  });

  it("还原转义字符，空文档返回空串", () => {
    expect(markdownToPlainText("价格 \\*不含税\\*")).toBe("价格 *不含税*");
    expect(markdownToPlainText("   \n\n  ")).toBe("");
  });
});
