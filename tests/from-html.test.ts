import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "@/lib/markdown/from-html";
import { renderMarkdown } from "@/lib/markdown/parse";

describe("富文本粘贴", () => {
  it("格式片段两侧的单词间隔不能丢失", () => {
    const result = htmlToMarkdown(
      '<p>first<strong> second </strong><em>third </em><a href="https://example.com"> last </a>end</p>',
    );
    expect(renderMarkdown(result).text).toBe("first second third last end");
  });
  it("保留标题、加粗、斜体、链接和嵌套列表", () => {
    const result = htmlToMarkdown(
      '<h2>标题</h2><p>这是<strong>重点</strong>和<em>补充</em>，<a href="https://example.com/a(b)">来源</a></p><ol start="3"><li>第三项<ul><li>子项</li></ul></li><li>第四项</li></ol>',
    );
    expect(result).toContain("## 标题");
    expect(result).toContain("**重点**和*补充*");
    expect(result).toContain("[来源](https://example.com/a%28b%29)");
    expect(result).toContain("3. 第三项\n    - 子项\n4. 第四项");
    expect(renderMarkdown(result).html).toContain('<ol start="3"');
  });
  it("识别 Word 样式并丢弃脚本、事件和危险链接", () => {
    const result = htmlToMarkdown(
      '<p><span style="font-weight:700;color:red;background:url(https://evil.test)">文字</span></p><script>alert(1)</script><a href="javascript:alert(1)">链接</a><img src="x" onerror="alert(1)">',
    );
    expect(result).toContain("**文字**");
    expect(result).not.toMatch(/alert|javascript|evil|onerror|style=/);
    expect(result).toContain("链接");
  });
  it("代码中的空格、反引号与换行不丢失", () => {
    const result = htmlToMarkdown(
      "<pre><code>  const x = `value`;\n\n\n    return x;\n</code></pre>",
    );
    expect(result).toBe("```\n  const x = `value`;\n\n\n    return x;\n```");
  });
  it("表格和可携带图片可再次渲染", () => {
    const result = htmlToMarkdown(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>一</td><td>二</td></tr></table><p><img src="https://example.com/a.png" alt="配图"></p>',
    );
    const rendered = renderMarkdown(result);
    expect(rendered.html).toContain("<table");
    expect(rendered.images).toEqual(["https://example.com/a.png"]);
  });
});
