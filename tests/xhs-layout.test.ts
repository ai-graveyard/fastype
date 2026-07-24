import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown/parse";
import {
  applyListStart,
  cloneForPage,
  prepareForMeasure,
  splitTargetOf,
} from "@/lib/render/xhs-layout";
import {
  applyXhsBodyTitleOverride,
  applyXhsHeadingNumbers,
  contentWidth,
  xhsCardCss,
  xhsFooterBlockHeight,
} from "@/lib/render/xhs";
import {
  DEFAULT_XHS_STYLE,
  getXhsCanvasSize,
  XHS_CANVAS_HEIGHT,
  XHS_CANVAS_WIDTH,
} from "@/lib/themes/xhs";

function mount(markdown: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderMarkdown(markdown).html;
  return container;
}

describe("prepareForMeasure", () => {
  it("把长段落切成句子，让超长段落也能分页", () => {
    const container = mount("第一句。第二句。第三句。");
    prepareForMeasure(container);
    const spans = container.querySelectorAll("p > span.ft-split");
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toBe("第一句。");
  });

  it("拆句不改变可见文本", () => {
    const source = "第一句。第二句！第三句？";
    const container = mount(source);
    const before = container.textContent;
    prepareForMeasure(container);
    expect(container.textContent).toBe(before);
  });

  it("单句段落不拆", () => {
    const container = mount("只有一句话");
    prepareForMeasure(container);
    expect(container.querySelectorAll("span.ft-split")).toHaveLength(0);
  });

  it("含行内标记的段落保持原结构，避免破坏加粗和链接", () => {
    const container = mount("第一句**加粗**。第二句。");
    prepareForMeasure(container);
    expect(container.querySelector("strong")).not.toBeNull();
  });

  it("代码块按行切分，空行也占一行", () => {
    const container = mount("```\na\n\nb\n```");
    prepareForMeasure(container);
    const lines = container.querySelectorAll("pre > code > span.ft-split");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1].textContent).toBe("\u00a0");
  });
});

describe("splitTargetOf", () => {
  it("列表按 li 拆", () => {
    const container = mount("- a\n- b\n- c");
    const target = splitTargetOf(container.querySelector("ul")!);
    expect(target?.parts).toHaveLength(3);
  });

  it("表格按 tbody 行拆", () => {
    const container = mount("| A |\n| - |\n| 1 |\n| 2 |");
    const target = splitTargetOf(container.querySelector("table")!);
    expect(target?.parts).toHaveLength(2);
    expect(target?.container.tagName.toLowerCase()).toBe("tbody");
  });

  it("单项列表不可拆", () => {
    const container = mount("- 只有一项");
    expect(splitTargetOf(container.querySelector("ul")!)).toBeNull();
  });

  it("标题、图片和分割线不可拆", () => {
    const container = mount("# 标题\n\n![a](https://x/a.png)\n\n---");
    expect(splitTargetOf(container.querySelector("h1")!)).toBeNull();
    expect(splitTargetOf(container.querySelector("hr")!)).toBeNull();
  });

  it("代码块在预处理后可以按行拆", () => {
    const container = mount("```\na\nb\nc\n```");
    prepareForMeasure(container);
    const target = splitTargetOf(container.querySelector("pre")!);
    expect(target?.parts.length).toBeGreaterThanOrEqual(3);
    expect(target?.container.tagName.toLowerCase()).toBe("code");
  });
});

describe("cloneForPage", () => {
  it("整块放置时原样克隆", () => {
    const container = mount("- a\n- b\n- c");
    const nodes = Array.from(container.children) as HTMLElement[];
    const targets = nodes.map(splitTargetOf);
    const clone = cloneForPage({ blockIndex: 0 }, nodes, targets);
    expect(clone?.querySelectorAll("li")).toHaveLength(3);
  });

  it("按子项范围裁剪，且不改动源节点", () => {
    const container = mount("- a\n- b\n- c\n- d");
    const nodes = Array.from(container.children) as HTMLElement[];
    const targets = nodes.map(splitTargetOf);

    const first = cloneForPage({ blockIndex: 0, childRange: [0, 2] }, nodes, targets);
    expect(first?.querySelectorAll("li")).toHaveLength(2);
    expect(first?.textContent).toContain("a");
    expect(first?.textContent).not.toContain("c");

    const second = cloneForPage({ blockIndex: 0, childRange: [2, 4] }, nodes, targets);
    expect(second?.textContent).toContain("c");
    expect(second?.textContent).not.toContain("a");

    // 源节点必须完好，否则下一次分页会越切越少。
    expect(container.querySelectorAll("li")).toHaveLength(4);
  });

  it("表格拆页后保留表头行结构", () => {
    const container = mount("| A |\n| - |\n| 1 |\n| 2 |\n| 3 |");
    const nodes = Array.from(container.children) as HTMLElement[];
    const targets = nodes.map(splitTargetOf);
    const clone = cloneForPage({ blockIndex: 0, childRange: [1, 3] }, nodes, targets);
    expect(clone?.querySelector("thead")).not.toBeNull();
    expect(clone?.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("越界下标返回 null 而不是抛错", () => {
    expect(cloneForPage({ blockIndex: 99 }, [], [])).toBeNull();
  });
});

describe("applyListStart", () => {
  it("有序列表续页时接着上一页的序号", () => {
    const container = mount("1. a\n2. b\n3. c");
    const ol = container.querySelector("ol")!.cloneNode(true) as HTMLElement;
    applyListStart(ol, 2);
    expect(ol.getAttribute("start")).toBe("3");
  });

  it("第一页不加 start 属性", () => {
    const container = mount("1. a\n2. b");
    const ol = container.querySelector("ol")!.cloneNode(true) as HTMLElement;
    applyListStart(ol, 0);
    expect(ol.getAttribute("start")).toBeNull();
  });

  it("无序列表不受影响", () => {
    const container = mount("- a\n- b");
    const ul = container.querySelector("ul")!.cloneNode(true) as HTMLElement;
    applyListStart(ul, 2);
    expect(ul.getAttribute("start")).toBeNull();
  });
});

describe("卡片尺寸与样式", () => {
  it("画布是 3:4", () => {
    expect(XHS_CANVAS_HEIGHT / XHS_CANVAS_WIDTH).toBeCloseTo(4 / 3, 5);
  });

  it("内容宽度扣掉左右边距", () => {
    expect(contentWidth({ ...DEFAULT_XHS_STYLE, padding: 80 })).toBe(XHS_CANVAS_WIDTH - 160);
  });

  it("常用比例与自定义画布都会进入真实分页尺寸", () => {
    expect(getXhsCanvasSize({ ...DEFAULT_XHS_STYLE, aspectRatio: "1:1" })).toEqual({
      width: 1080,
      height: 1080,
    });
    expect(
      getXhsCanvasSize({
        ...DEFAULT_XHS_STYLE,
        aspectRatio: "custom",
        customWidth: 1440,
        customHeight: 1800,
      }),
    ).toEqual({ width: 1440, height: 1800 });
  });

  it("CSS 使用用户设置的字号、行高和颜色", () => {
    const css = xhsCardCss({
      ...DEFAULT_XHS_STYLE,
      fontSize: 42,
      lineHeight: 2,
      textColor: "#123456",
      accentColor: "#abcdef",
    });
    expect(css).toContain("font-size: 42px");
    expect(css).toContain("line-height: 2");
    expect(css).toContain("#123456");
    expect(css).toContain("#abcdef");
  });

  it("图片有高度上限，不会产生无法分页的超高块", () => {
    expect(xhsCardCss(DEFAULT_XHS_STYLE)).toContain("max-height");
  });

  it("页脚序号支持左中右对齐", () => {
    expect(xhsCardCss({ ...DEFAULT_XHS_STYLE, pageNumberAlign: "left" })).toContain(
      "justify-content: flex-start",
    );
    expect(xhsCardCss({ ...DEFAULT_XHS_STYLE, pageNumberAlign: "center" })).toContain(
      "justify-content: center",
    );
    expect(xhsCardCss({ ...DEFAULT_XHS_STYLE, pageNumberAlign: "right" })).toContain(
      "justify-content: flex-end",
    );
  });

  it("页脚序号沿用 LovType 的轻量纯文字样式", () => {
    const css = xhsCardCss(DEFAULT_XHS_STYLE);

    expect(css).toContain("font-size: 35px");
    expect(css).toContain("opacity: 0.5");
    expect(css).toContain("font-weight: 400");
    expect(css).not.toContain(".ft-xhs-page-dot {\n  padding:");
    expect(css).not.toContain(".ft-xhs-page-dot {\n  border-radius:");
    expect(css).not.toContain(".ft-xhs-page-dot {\n  background:");
  });

  it("页脚序号支持缩放，并以独立块靠近画布底边", () => {
    const style = {
      ...DEFAULT_XHS_STYLE,
      padding: 84,
      pageNumberScale: 4,
    };
    const css = xhsCardCss(style);

    expect(css).toContain("font-size: 56px");
    expect(xhsFooterBlockHeight(style)).toBe(76);
    expect(css).toContain("position: relative");
    expect(css).toContain("flex: 0 0 76px");
    expect(css).toContain("min-height: 76px");
    expect(css).toContain("transform: translateY(52px)");
    expect(css).not.toContain("position: absolute");
  });

  it("标题模板和标题级别配置进入导出 CSS", () => {
    const css = xhsCardCss({
      ...DEFAULT_XHS_STYLE,
      headingTemplate: "underline",
      headings: {
        ...DEFAULT_XHS_STYLE.headings,
        h1: { ...DEFAULT_XHS_STYLE.headings.h1, scale: 2, spacing: 1.5, weight: 900, align: "center" },
      },
    });
    expect(css).toContain("font-size: 68px");
    expect(css).toContain("font-weight: 900");
    expect(css).toContain("text-align: center");
    expect(css).toContain("border-bottom");
  });

  it("标题背景色 / 文字色为空时不产生额外样式", () => {
    const css = xhsCardCss(DEFAULT_XHS_STYLE);
    expect(css).not.toContain(".ft-xhs-card h1 { background:");
    expect(css).not.toContain(".ft-xhs-card h1 { color:");
  });

  it("标题背景色 / 文字色按级别独立生效，且覆盖模板默认颜色", () => {
    const css = xhsCardCss({
      ...DEFAULT_XHS_STYLE,
      headingTemplate: "highlight",
      headings: {
        ...DEFAULT_XHS_STYLE.headings,
        h1: { ...DEFAULT_XHS_STYLE.headings.h1, background: "#ff0000", textColor: "#00ff00" },
      },
    });
    expect(css).toContain(".ft-xhs-card h1 { background: #ff0000;");
    expect(css).toContain("color: #00ff00;");
    // h2 未设置，保持默认（不产生 h2 专属的颜色覆盖规则）
    expect(css).not.toContain(".ft-xhs-card h2 { background:");
  });

  it("标题始终横向排版，雅致模板的装饰线不会挤压文字", () => {
    const css = xhsCardCss({
      ...DEFAULT_XHS_STYLE,
      headingTemplate: "elegant",
    });

    expect(css).toContain("writing-mode: horizontal-tb");
    expect(css).toContain("text-orientation: mixed");
    expect(css).toContain("position: relative; display: block");
    expect(css).toContain(
      ".ft-xhs-card h1::before, .ft-xhs-card h2::before, .ft-xhs-card h3::before",
    );
    expect(css).toContain(
      ".ft-xhs-card h1::after, .ft-xhs-card h2::after, .ft-xhs-card h3::after",
    );
    expect(css).not.toContain(
      ".ft-xhs-card h1, .ft-xhs-card h2, .ft-xhs-card h3::before",
    );
    expect(css).not.toContain("padding-inline");
    expect(css).not.toContain("display: flex; align-items: center; gap: 0.45em");
  });

  it("段落间距会同步应用到段落、列表和引用", () => {
    const css = xhsCardCss({ ...DEFAULT_XHS_STYLE, fontSize: 40, paragraphSpacing: 1 });
    expect(css).toContain("margin: 0 0 40px");
  });

  it("正文细节与元素级设置进入预览和导出共用 CSS", () => {
    const css = xhsCardCss({
      ...DEFAULT_XHS_STYLE,
      fontWeight: 500,
      letterSpacing: 2,
      textIndent: true,
      elements: {
        ...DEFAULT_XHS_STYLE.elements,
        strongColor: "#ff0000",
        unorderedListStyle: "square",
        quoteBorderWidth: 8,
        codeRadius: 20,
      },
    });

    expect(css).toContain("font-weight: 500");
    expect(css).toContain("letter-spacing: 2px");
    expect(css).toContain("text-indent: 2em");
    expect(css).toContain("color: #ff0000");
    expect(css).toContain("list-style: square");
    expect(css).toContain("border-left: 8px");
    expect(css).toContain("border-radius: 20px");
  });
});

describe("applyXhsHeadingNumbers", () => {
  it("默认关闭时原样返回，不插入任何编号节点", () => {
    const html = renderMarkdown("## 第一节\n\n## 第二节").html;
    expect(applyXhsHeadingNumbers(html, DEFAULT_XHS_STYLE)).toBe(html);
  });

  it("开启后按标题层级各自独立计数，并带上标签和颜色", () => {
    const html = renderMarkdown("## 第一节\n\n## 第二节").html;
    const result = applyXhsHeadingNumbers(html, {
      ...DEFAULT_XHS_STYLE,
      headings: {
        ...DEFAULT_XHS_STYLE.headings,
        h2: {
          ...DEFAULT_XHS_STYLE.headings.h2,
          number: {
            ...DEFAULT_XHS_STYLE.headings.h2.number,
            enabled: true,
            position: "top",
            color: "#123456",
            opacity: 0.4,
            labelText: "PART",
          },
        },
      },
    });
    expect(result).toContain("01");
    expect(result).toContain("02");
    expect(result).toContain("PART");
    expect(result).toContain("#123456");
    expect(result).toContain("opacity: 0.4");
  });

  it("一二三级标题的编号互不影响", () => {
    const html = renderMarkdown("# 大标题\n\n## 第一节\n\n### 小节 A\n\n### 小节 B").html;
    const result = applyXhsHeadingNumbers(html, {
      ...DEFAULT_XHS_STYLE,
      headings: {
        h1: { ...DEFAULT_XHS_STYLE.headings.h1, number: { ...DEFAULT_XHS_STYLE.headings.h1.number, enabled: false } },
        h2: { ...DEFAULT_XHS_STYLE.headings.h2, number: { ...DEFAULT_XHS_STYLE.headings.h2.number, enabled: false } },
        h3: { ...DEFAULT_XHS_STYLE.headings.h3, number: { ...DEFAULT_XHS_STYLE.headings.h3.number, enabled: true } },
      },
    });
    const h1 = result.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
    expect(h1).not.toContain("01");
    expect(result).toContain("01");
    expect(result).toContain("02");
  });
});

describe("applyXhsBodyTitleOverride", () => {
  it("留空时原样返回，不改动正文里的一级标题", () => {
    const html = renderMarkdown("# 原始标题\n\n正文").html;
    expect(applyXhsBodyTitleOverride(html, "")).toBe(html);
    expect(applyXhsBodyTitleOverride(html, "   ")).toBe(html);
  });

  it("已有一级标题时，只替换标题文字，不影响正文其余内容", () => {
    const html = renderMarkdown("# 原始标题\n\n正文段落").html;
    const result = applyXhsBodyTitleOverride(html, "自定义标题");
    expect(result).toContain("<h1>自定义标题</h1>");
    expect(result).not.toContain("原始标题");
    expect(result).toContain("正文段落");
  });

  it("没有一级标题时会在最前面补一个，不依赖 Markdown 正文", () => {
    const html = renderMarkdown("只有正文，没有标题").html;
    const result = applyXhsBodyTitleOverride(html, "补充的标题");
    expect(result.startsWith("<h1>补充的标题</h1>")).toBe(true);
  });

  it("支持多行标题，换行会转换成 <br>，同时会转义 HTML 特殊字符", () => {
    const html = renderMarkdown("# 原始标题").html;
    const result = applyXhsBodyTitleOverride(html, "第一行\n第二行 <script>");
    expect(result).toContain("<h1>第一行<br>第二行 &lt;script&gt;</h1>");
  });
});
