import { beforeEach, describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown/parse";
import {
  buildPortableHtml,
  buildPortableNode,
  buildStandaloneDocument,
} from "@/lib/render/portable";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.className = "md-preview md-theme-github";
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("buildPortableNode", () => {
  it("清掉预览内部的标记，不把 class 和行号带出去", () => {
    const { html } = renderMarkdown("# 标题\n\n正文");
    const node = buildPortableNode(mount(html));

    expect(node.getAttribute("class")).toBeNull();
    expect(node.outerHTML).not.toContain("data-source-line");
    expect(node.outerHTML).not.toContain("md-preview");
    // 内容本身一个字都不能少。
    expect(node.querySelector("h1")?.textContent).toBe("标题");
    expect(node.textContent).toContain("正文");
  });

  it("代码块改成折行，表格改成铺满宽度", () => {
    const { html } = renderMarkdown("```\ncode\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |");
    const node = buildPortableNode(mount(html));

    // 预览里代码块横向滚动、表格是 max-content 宽，粘进文档后都没有滚动条这回事。
    expect(node.querySelector("pre")?.getAttribute("style")).toContain("white-space: pre-wrap");
    const table = node.querySelector("table")?.getAttribute("style") ?? "";
    expect(table).toContain("display: table");
    expect(table).toContain("width: 100%");
  });

  it("图片限制最大宽度，避免粘进去撑破版心", () => {
    const { html } = renderMarkdown("![图](https://example.com/a.png)");
    const node = buildPortableNode(mount(html));
    expect(node.querySelector("img")?.getAttribute("style")).toContain("max-width: 100%");
  });

  it("不改动原始预览节点", () => {
    const { html } = renderMarkdown("# 标题");
    const source = mount(html);
    const before = source.outerHTML;
    buildPortableNode(source);
    expect(source.outerHTML).toBe(before);
  });
});

describe("buildPortableHtml", () => {
  it("同时给出 HTML 和纯文本两种格式", () => {
    const { html } = renderMarkdown("# 标题\n\n正文");
    const result = buildPortableHtml(mount(html));

    expect(result.html).toContain("<h1");
    expect(result.plainText).toContain("标题");
    expect(result.plainText).not.toContain("<h1");
  });
});

describe("buildStandaloneDocument", () => {
  it("产物是自包含的，不引用任何外部资源", () => {
    const doc = buildStandaloneDocument("<div>正文</div>", "我的文章");

    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<title>我的文章</title>");
    expect(doc).toContain("<div>正文</div>");
    expect(doc).not.toMatch(/<link|<script|src="http/);
  });

  it("标题里的尖括号会被转义，不会撑破 title 标签", () => {
    const doc = buildStandaloneDocument("<p>x</p>", '<img src=x onerror="alert(1)">');
    expect(doc).toContain("&lt;img");
    expect(doc).not.toContain("<title><img");
  });
});
