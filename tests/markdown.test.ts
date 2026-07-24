import { describe, expect, it } from "vitest";

import { extractTitleFromSource, renderMarkdown } from "@/lib/markdown/parse";
import {
  countPreviewContent,
  countText,
  estimateReadingMinutes,
  formatBytes,
} from "@/lib/markdown/stats";

describe("renderMarkdown", () => {
  it("渲染常见语法", () => {
    const { html } = renderMarkdown(
      "# 标题\n\n**粗** *斜* ~~删~~\n\n- a\n- b\n\n> 引用\n\n`code`\n\n| A | B |\n| - | - |\n| 1 | 2 |",
    );
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain("<del>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<code>");
    expect(html).toContain("<table>");
  });

  it("把第一个一级标题作为标题", () => {
    expect(renderMarkdown("# 一\n\n## 二").title).toBe("一");
    expect(renderMarkdown("## 只有二级").title).toBeNull();
  });

  it("过滤 script 标签", () => {
    const { html } = renderMarkdown("<script>alert(1)</script>\n\n正文");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
    expect(html).toContain("正文");
  });

  it("过滤事件属性", () => {
    const { html } = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("过滤 style 属性，避免 url() 悄悄发起第三方请求", () => {
    const { html } = renderMarkdown(
      '<div style="background:url(https://evil.example.com/pixel.gif)">正文</div>',
    );
    expect(html).not.toContain("style=");
    expect(html).not.toContain("evil.example.com");
  });

  it("过滤 javascript: 协议链接", () => {
    const { html } = renderMarkdown("[点我](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("过滤 iframe 等危险标签", () => {
    const { html } = renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("外链带上安全的打开方式", () => {
    const { html } = renderMarkdown("[a](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });

  it("收集图片地址并标记跨域属性", () => {
    const { html, images } = renderMarkdown(
      "![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)\n\n![dup](https://example.com/1.png)",
    );
    expect(images).toEqual(["https://example.com/1.png", "https://example.com/2.png"]);
    expect(html).toContain('crossorigin="anonymous"');
  });

  it("单换行渲染为换行，符合中文写作习惯", () => {
    const { html } = renderMarkdown("第一行\n第二行");
    expect(html).toContain("<br>");
  });

  it("空输入返回空结果", () => {
    expect(renderMarkdown("   ")).toEqual({ html: "", title: null, text: "", images: [] });
  });

  it("语法异常时仍渲染其余内容", () => {
    const { html } = renderMarkdown("| 坏表格\n\n正常段落");
    expect(html).toContain("正常段落");
  });
});

describe("extractTitleFromSource", () => {
  it("取第一个一级标题", () => {
    expect(extractTitleFromSource("前言\n\n# 真标题\n\n# 第二个")).toBe("真标题");
  });

  it("跳过代码块里的井号", () => {
    expect(extractTitleFromSource("```\n# 这是注释\n```\n\n# 真标题")).toBe("真标题");
  });

  it("没有一级标题时返回 null", () => {
    expect(extractTitleFromSource("## 二级\n正文")).toBeNull();
  });

  it("忽略 ATX 结尾的井号", () => {
    expect(extractTitleFromSource("# 标题 #")).toBe("标题");
  });
});

describe("countText", () => {
  it("中文按字、英文按词", () => {
    expect(countText("你好世界")).toEqual({ words: 4, chars: 4 });
    expect(countText("hello world").words).toBe(2);
    expect(countText("你好 world").words).toBe(3);
  });

  it("空白不计入", () => {
    expect(countText("   \n  ")).toEqual({ words: 0, chars: 0 });
  });

  it("emoji 按码点计数，不会被拆成两个字符", () => {
    expect(countText("🎉").chars).toBe(1);
  });
});

describe("预览内容统计", () => {
  it("统计图片、小标题和远程图片", () => {
    expect(
      countPreviewContent(
        '<h1>标题</h1><h2>一</h2><h3>二</h3><img src="https://example.com/a.png"><img src="data:image/png;base64,x">',
      ),
    ).toEqual({ images: 2, subheadings: 2, remoteImages: 1 });
  });

  it("阅读时长至少一分钟，空内容为零", () => {
    expect(estimateReadingMinutes(0)).toBe(0);
    expect(estimateReadingMinutes(1)).toBe(1);
    expect(estimateReadingMinutes(401)).toBe(2);
  });
});

describe("formatBytes", () => {
  it("按量级格式化", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
