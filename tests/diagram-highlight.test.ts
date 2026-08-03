import { describe, expect, it } from "vitest";

import {
  DIAGRAM_KIND_ATTRIBUTE,
  DIAGRAM_SOURCE_ATTRIBUTE,
  decodeDiagramSource,
  encodeDiagramSource,
} from "@/lib/markdown/diagram";
import { HIGHLIGHT_LANGUAGE_ATTRIBUTE, highlightCodeBlocks } from "@/lib/markdown/highlight";
import { renderMarkdown } from "@/lib/markdown/parse";
import { renderWechat } from "@/lib/render/wechat";
import { highlightPalette } from "@/lib/themes/highlight";
import { DEFAULT_WECHAT_STYLE } from "@/lib/themes/wechat";

function holderFor(html: string): HTMLDivElement {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return holder;
}

describe("图表代码块", () => {
  it("mermaid 和 markmap 变成带源码的占位", () => {
    const source = "```mermaid\ngraph TD;\n  A-->B;\n```\n\n```markmap\n# 中心\n## 分支\n```";
    const holder = holderFor(renderMarkdown(source).html);

    const hosts = holder.querySelectorAll(`[${DIAGRAM_KIND_ATTRIBUTE}]`);
    expect(hosts).toHaveLength(2);
    expect(hosts[0].getAttribute(DIAGRAM_KIND_ATTRIBUTE)).toBe("mermaid");
    expect(hosts[1].getAttribute(DIAGRAM_KIND_ATTRIBUTE)).toBe("markmap");
    expect(decodeDiagramSource(hosts[0].getAttribute(DIAGRAM_SOURCE_ATTRIBUTE) ?? "")).toBe(
      "graph TD;\n  A-->B;",
    );
  });

  it("源码里的中文和引号都能原样取回", () => {
    const source = 'graph TD;\n  A["带引号的中文"] --> B;';
    expect(decodeDiagramSource(encodeDiagramSource(source))).toBe(source);
  });

  it("坏掉的 base64 解出空串，不抛异常", () => {
    expect(decodeDiagramSource("!!!not base64!!!")).toBe("");
  });

  it("其它语言的代码块不受影响", () => {
    const holder = holderFor(renderMarkdown("```js\nconst a = 1;\n```").html);
    expect(holder.querySelector(`[${DIAGRAM_KIND_ATTRIBUTE}]`)).toBeNull();
    expect(holder.querySelector("pre code")).toBeTruthy();
  });

  it("代码块内容按 HTML 转义，不会被当成标签", () => {
    const holder = holderFor(renderMarkdown("```html\n<script>alert(1)</script>\n```").html);
    expect(holder.querySelector("script")).toBeNull();
    expect(holder.querySelector("code")?.textContent).toContain("<script>alert(1)</script>");
  });
});

describe("代码高亮", () => {
  it("带语言的代码块留下语言名", () => {
    const holder = holderFor(renderMarkdown("```TypeScript\nconst a = 1;\n```").html);
    expect(holder.querySelector("code")?.getAttribute(HIGHLIGHT_LANGUAGE_ATTRIBUTE)).toBe(
      "typescript",
    );
  });

  it("没有语言标记的代码块不参与高亮", () => {
    const holder = holderFor(renderMarkdown("```\n纯文本\n```").html);
    expect(holder.querySelector("code")?.hasAttribute(HIGHLIGHT_LANGUAGE_ATTRIBUTE)).toBe(false);
  });

  it("奇怪的语言名不会被写进属性", () => {
    const holder = holderFor(renderMarkdown('```js" onload="alert(1)\nx\n```').html);
    expect(holder.querySelector("code")?.hasAttribute(HIGHLIGHT_LANGUAGE_ATTRIBUTE)).toBe(false);
  });

  it("上色后打标记，重复调用不会重复处理", async () => {
    const holder = holderFor(renderMarkdown("```js\nconst a = 1;\n```").html);
    document.body.appendChild(holder);

    expect(await highlightCodeBlocks(holder)).toBe(1);
    expect(holder.querySelector(".ft-hl-keyword")).toBeTruthy();
    expect(await highlightCodeBlocks(holder)).toBe(0);

    holder.remove();
  });

  it("代码原文不会因为上色而改变", async () => {
    const holder = holderFor(renderMarkdown("```js\nconst a = 1;\n```").html);
    await highlightCodeBlocks(holder);
    expect(holder.querySelector("code")?.textContent?.trim()).toBe("const a = 1;");
  });
});

describe("公众号里的图表与高亮", () => {
  it("高亮颜色写成内联样式，因为 class 会被剥掉", async () => {
    const holder = holderFor(renderMarkdown("```js\nconst a = 1;\n```").html);
    await highlightCodeBlocks(holder);

    const { html } = renderWechat(holder.innerHTML, DEFAULT_WECHAT_STYLE);
    const rendered = holderFor(html);
    const spans = Array.from(rendered.querySelectorAll("span"));

    expect(spans.length).toBeGreaterThan(0);
    expect(spans.every((span) => !span.hasAttribute("class"))).toBe(true);
    const palette = highlightPalette(false);
    expect(spans.some((span) => (span.getAttribute("style") ?? "").includes(palette.keyword))).toBe(
      true,
    );
  });

  it("图表会给出兼容性提醒", () => {
    const { html } = renderMarkdown("```mermaid\ngraph TD;\n  A-->B;\n```");
    const result = renderWechat(html, DEFAULT_WECHAT_STYLE);

    expect(result.warnings).toContain("wechat.compatDiagram");
    expect(result.issues.some((issue) => issue.warning === "wechat.compatDiagram")).toBe(true);
  });

  it("占位属性能活到渲染那一步", () => {
    const { html } = renderMarkdown("```mermaid\ngraph TD;\n  A-->B;\n```");
    const result = renderWechat(html, DEFAULT_WECHAT_STYLE);
    const rendered = holderFor(result.html);

    expect(rendered.querySelector(`[${DIAGRAM_KIND_ATTRIBUTE}]`)).toBeTruthy();
    expect(rendered.querySelector(`[${DIAGRAM_SOURCE_ATTRIBUTE}]`)).toBeTruthy();
  });
});
