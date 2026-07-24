import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown/parse";
import { buildWechatDocument, renderWechat, wechatRootStyle } from "@/lib/render/wechat";
import { DEFAULT_WECHAT_STYLE, wechatStyleFromTheme } from "@/lib/themes/wechat";

function render(markdown: string, style = DEFAULT_WECHAT_STYLE) {
  return renderWechat(renderMarkdown(markdown).html, style);
}

describe("renderWechat", () => {
  it("每个块级元素都带内联样式，不依赖外部 CSS", () => {
    const { html } = render("# 标题\n\n正文\n\n- 项目\n\n> 引用");
    for (const tag of ["h1", "p", "ul", "li", "blockquote"]) {
      const match = html.match(new RegExp(`<${tag}[^>]*>`));
      expect(match, `${tag} 应该存在`).not.toBeNull();
      expect(match?.[0], `${tag} 应该带 style`).toContain("style=");
    }
  });

  it("不带入 FasType 自身的 class 和 id", () => {
    const { html } = render('<p class="md-preview" id="x">正文</p>');
    expect(html).not.toContain("class=");
    expect(html).not.toContain("id=");
  });

  it("外层容器承载字体和行高", () => {
    const style = { ...DEFAULT_WECHAT_STYLE, fontSize: 18, lineHeight: 2 };
    const { html } = render("正文", style);
    expect(html.startsWith("<section")).toBe(true);
    expect(html).toContain("font-size: 18px");
    expect(html).toContain("line-height: 2");
  });

  it("代码块折行而不是横向滚动，避免公众号里看不到右侧内容", () => {
    const { html } = render("```\nlong code line\n```");
    const pre = html.match(/<pre[^>]*>/)?.[0] ?? "";
    expect(pre).toContain("white-space: pre-wrap");
    expect(pre).toContain("word-break: break-all");
  });

  it("代码块内的 code 不重复背景色", () => {
    const { html } = render("```\nx\n```");
    const codeTag = html.match(/<pre[^>]*>\s*<code[^>]*>/)?.[0] ?? "";
    expect(codeTag).toContain("background: transparent");
  });

  it("引用支持竖线和卡片两种样式", () => {
    const bar = render("> 引用", wechatStyleFromTheme("classic")).html;
    expect(bar).toContain("border-left");

    const card = render("> 引用", { ...DEFAULT_WECHAT_STYLE, quoteStyle: "card" }).html;
    const quote = card.match(/<blockquote[^>]*>/)?.[0] ?? "";
    expect(quote).not.toContain("border-left");
    expect(quote).toContain("border-radius");
  });

  it("标题样式随配置变化", () => {
    const badge = render("# 标题", { ...DEFAULT_WECHAT_STYLE, headingStyle: "badge" }).html;
    expect(badge).toContain("border-radius");

    const plain = render("# 标题", { ...DEFAULT_WECHAT_STYLE, headingStyle: "plain" }).html;
    const h1 = plain.match(/<h1[^>]*>/)?.[0] ?? "";
    expect(h1).not.toContain("border-left");
  });

  it("标题编号支持位置、标签、颜色与透明度", () => {
    const { html } = render("## 第一节\n\n## 第二节", {
      ...DEFAULT_WECHAT_STYLE,
      headings: {
        ...DEFAULT_WECHAT_STYLE.headings,
        h2: {
          ...DEFAULT_WECHAT_STYLE.headings.h2,
          number: {
            ...DEFAULT_WECHAT_STYLE.headings.h2.number,
            enabled: true,
            position: "top",
            color: "#123456",
            opacity: 0.4,
            labelText: "PART",
            labelPosition: "right",
          },
        },
      },
    });
    expect(html).toContain("01");
    expect(html).toContain("02");
    expect(html).toContain("PART");
    expect(html).toContain("#123456");
    expect(html).toContain("opacity: 0.4");
  });

  it("一二三级标题的编号各自独立开关和计数", () => {
    const { html } = render("# 大标题\n\n## 第一节\n\n### 小节 A\n\n### 小节 B", {
      ...DEFAULT_WECHAT_STYLE,
      headings: {
        h1: { ...DEFAULT_WECHAT_STYLE.headings.h1, number: { ...DEFAULT_WECHAT_STYLE.headings.h1.number, enabled: false } },
        h2: { ...DEFAULT_WECHAT_STYLE.headings.h2, number: { ...DEFAULT_WECHAT_STYLE.headings.h2.number, enabled: false } },
        h3: { ...DEFAULT_WECHAT_STYLE.headings.h3, number: { ...DEFAULT_WECHAT_STYLE.headings.h3.number, enabled: true } },
      },
    });
    const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
    expect(h1).not.toContain("01");
    expect(html).toContain("01");
    expect(html).toContain("02");
  });

  it("一二三级标题的字号比例、字重和对齐可以独立配置", () => {
    const { html } = render("# 大标题\n\n## 小节", {
      ...DEFAULT_WECHAT_STYLE,
      headings: {
        ...DEFAULT_WECHAT_STYLE.headings,
        h1: { ...DEFAULT_WECHAT_STYLE.headings.h1, scale: 1.4, weight: 900, align: "center" },
        h2: { ...DEFAULT_WECHAT_STYLE.headings.h2, scale: 0.8, weight: 400, align: "right" },
      },
    });
    const h1 = html.match(/<h1[^>]*>/)?.[0] ?? "";
    const h2 = html.match(/<h2[^>]*>/)?.[0] ?? "";
    expect(h1).toContain("font-weight: 900");
    expect(h1).toContain("text-align: center");
    expect(h2).toContain("font-weight: 400");
    expect(h2).toContain("text-align: right");
  });

  it("一二三级标题可以单独设置背景色和文字色，覆盖模板默认配色", () => {
    const { html } = render("# 大标题\n\n## 小节", {
      ...DEFAULT_WECHAT_STYLE,
      headingTemplate: "underline",
      headings: {
        ...DEFAULT_WECHAT_STYLE.headings,
        h1: { ...DEFAULT_WECHAT_STYLE.headings.h1, background: "#112233", textColor: "#ffffff" },
      },
    });
    const h1 = html.match(/<h1[^>]*>/)?.[0] ?? "";
    const h2 = html.match(/<h2[^>]*>/)?.[0] ?? "";
    expect(h1).toContain("background: rgb(17, 34, 51)");
    expect(h1).toContain("color: rgb(255, 255, 255)");
    expect(h2).not.toContain("background:");
  });

  it("粗体高亮支持 Lovtype 的分段高度", () => {
    const { html } = render("**重点**", {
      ...DEFAULT_WECHAT_STYLE,
      strongHighlight: "#ffcc00",
      strongHighlightHeight: "third-center",
      strongHighlightOpacity: 0.5,
    });
    const strong = html.match(/<strong[^>]*>/)?.[0] ?? "";
    expect(strong).toContain("linear-gradient");
    expect(strong).toContain("33%");
    expect(strong).toContain("67%");
  });

  it("引用块支持独立边线颜色、外间距和内间距", () => {
    const { html } = render("正文\n\n> 引用\n\n结尾", {
      ...DEFAULT_WECHAT_STYLE,
      quoteBorderColor: "#654321",
      quoteSpacing: 28,
      quotePadding: 18,
    });
    const quote = html.match(/<blockquote[^>]*>/)?.[0] ?? "";
    expect(quote).toContain("margin: 28px 0");
    expect(quote).toContain("padding: 18px 16px");
    expect(quote).toContain("#654321");
  });

  it("身份卡片支持各区域对齐、字号与头像占位", () => {
    const { html } = render("# 正文标题\n\n正文", {
      ...DEFAULT_WECHAT_STYLE,
      identityCard: {
        ...DEFAULT_WECHAT_STYLE.identityCard,
        enabled: true,
        badge: "专栏",
        badgeAlign: "right",
        title: "卡片标题",
        titleAlign: "center",
        titleFontSize: 34,
        subtitle: "副标题",
        subtitleAlign: "right",
        subtitleFontSize: 18,
        nickname: "小明",
        authorAlign: "center",
      },
    });
    expect(html).toContain('data-wechat-card="identity"');
    expect(html).toContain("font-size: 34px");
    expect(html).toContain("font-size: 18px");
    expect(html).toContain("text-align: center");
    expect(html).toContain(">小<");
  });

  it("身份卡片始终使用 Header 人设中的头像、名称和 Slogan", () => {
    const style = {
      ...DEFAULT_WECHAT_STYLE,
      identityCard: {
        ...DEFAULT_WECHAT_STYLE.identityCard,
        enabled: true,
        avatarUrl: "data:image/png;base64,OLD",
        nickname: "旧名称",
        slogan: "旧 Slogan",
      },
    };
    const { html } = renderWechat(renderMarkdown("正文").html, style, {
      avatar: "data:image/png;base64,NEW",
      name: "Header 名称",
      slogan: "Header Slogan",
    });

    expect(html).toContain('src="data:image/png;base64,NEW"');
    expect(html).toContain("Header 名称");
    expect(html).toContain("Header Slogan");
    expect(html).not.toContain("旧名称");
    expect(html).not.toContain("旧 Slogan");
  });

  it("文末引导卡支持动作高亮和身份信息位置", () => {
    const { html } = render("正文", {
      ...DEFAULT_WECHAT_STYLE,
      identityCard: {
        ...DEFAULT_WECHAT_STYLE.identityCard,
        enabled: true,
        nickname: "作者",
      },
      tailGuide: {
        ...DEFAULT_WECHAT_STYLE.tailGuide,
        enabled: true,
        likeHighlight: true,
        starHighlight: false,
        authorAlign: "right",
      },
    });
    expect(html).toContain('data-wechat-card="tail-guide"');
    expect(html).toContain("row-reverse");
    expect(html).toContain("font-weight: 600");
    expect(html).toContain("作者");
  });

  it("强调色应用到 strong 和链接", () => {
    const style = { ...DEFAULT_WECHAT_STYLE, accentColor: "#ff0000" };
    const { html } = render("**粗** 和 [链接](https://example.com)", style);
    expect(html).toContain("#ff0000");
  });

  it("任务列表复选框退化为符号", () => {
    const { html } = render("- [x] 完成\n- [ ] 待办");
    expect(html).not.toContain("<input");
    expect(html).toContain("☑");
    expect(html).toContain("☐");
  });

  it("给出兼容性提示", () => {
    const { warnings, issues } = render(
      "| A |\n| - |\n| 1 |\n\n```\ncode\n```\n\n[链接](https://example.com)\n\n![图](https://example.com/a.png)",
    );
    expect(warnings).toContain("wechat.compatTable");
    expect(warnings).toContain("wechat.compatCode");
    expect(warnings).toContain("wechat.compatLink");
    expect(warnings).toContain("wechat.compatImage");
    expect(issues).toEqual([
      expect.objectContaining({
        warning: "wechat.compatTable",
        index: 1,
        searchText: "A 1",
      }),
      expect.objectContaining({
        warning: "wechat.compatCode",
        index: 1,
        searchText: "code",
      }),
      expect.objectContaining({
        warning: "wechat.compatLink",
        index: 1,
        searchText: "链接",
      }),
      expect.objectContaining({
        warning: "wechat.compatImage",
        index: 1,
        searchText: "图",
      }),
    ]);
    expect(issues[2].preview).toContain("https://example.com");
  });

  it("纯文本降级保留内容分段", () => {
    const { plainText } = render("第一段\n\n第二段");
    expect(plainText).toContain("第一段");
    expect(plainText).toContain("第二段");
    expect(plainText).not.toContain("<");
  });

  it("消毒后的内容不会带脚本进入公众号", () => {
    const { html } = render('<script>alert(1)</script>\n\n正文');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("空输入返回空结果", () => {
    expect(render("")).toEqual({ html: "", plainText: "", warnings: [], issues: [] });
  });
});

describe("buildWechatDocument", () => {
  it("生成可直接打开的完整 HTML", () => {
    const doc = buildWechatDocument("<section>正文</section>", "我的文章");
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<title>我的文章</title>");
    expect(doc).toContain("<section>正文</section>");
  });

  it("转义标题里的尖括号", () => {
    expect(buildWechatDocument("", "<script>")).toContain("&lt;script&gt;");
  });
});

describe("wechatRootStyle", () => {
  it("包含正文色和字体族", () => {
    const style = wechatRootStyle({ ...DEFAULT_WECHAT_STYLE, textColor: "#123456" });
    expect(style).toContain("#123456");
    expect(style).toContain("font-family");
  });
});
