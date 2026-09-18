import { describe, expect, it } from "vitest";

import { extractMarkdownOutline } from "@/lib/markdown/outline";

describe("Markdown 文章目录", () => {
  it("提取 H1 到 H3 的文本、层级和行号", () => {
    expect(
      extractMarkdownOutline(
        ["# 标题", "", "## 章节一", "正文", "### 小节 ###", "#### 不进入目录"].join("\n"),
      ),
    ).toEqual([
      { level: 1, text: "标题", line: 1 },
      { level: 2, text: "章节一", line: 3 },
      { level: 3, text: "小节", line: 5 },
    ]);
  });

  it("跳过围栏代码块里的伪标题", () => {
    expect(
      extractMarkdownOutline(["~~~md", "# 不是标题", "~~~", "", "## 真标题"].join("\n")),
    ).toEqual([{ level: 2, text: "真标题", line: 5 }]);
  });
});
