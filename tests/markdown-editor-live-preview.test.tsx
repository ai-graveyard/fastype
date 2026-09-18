import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownEditor, type EditorApi } from "@/components/editor/markdown-editor";
import { __resetImageDbForTests } from "@/lib/image/db";
import { __resetImageCacheForTests, saveImageDataUrl } from "@/lib/image/library";

/** 1×1 红点 PNG，比透明像素好认。 */
const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// jsdom 不做真实布局，Range 上没有 getClientRects/getBoundingClientRect；
// CodeMirror 渲染表格、代码块这类块级 Widget 时会用到它们计算行高，补一个空实现即可。
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return [] as unknown as DOMRectList;
  };
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return new DOMRect();
  };
}

describe("Markdown Live Preview 编辑器", () => {
  afterEach(() => {
    // 图片库的会话缓存是模块级的，留着会串到别的用例里。
    __resetImageCacheForTests();
  });

  it("预览方式保留直接编辑能力，同时隐藏行号并展示 Markdown 排版", async () => {
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={"# 标题\n\n**重点**"}
          onChange={onChange}
          resetKey="live-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    expect(view.container.querySelector(".ft-markdown-live-preview")).toBeTruthy();
    expect(view.container.querySelector(".cm-gutters")).toBeNull();
    expect(view.container.querySelector(".ft-md-h1")).toBeTruthy();
    expect(view.container.querySelector(".ft-md-strong")).toBeTruthy();

    act(() => ref.current!.replaceSelection("新增"));
    expect(onChange).toHaveBeenLastCalledWith("新增# 标题\n\n**重点**");

    view.rerender(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={"新增# 标题\n\n**重点**"}
          onChange={onChange}
          resetKey="live-preview-test"
          ariaLabel="编辑区"
          mode="text"
        />
      </div>,
    );

    await waitFor(() => expect(view.container.querySelector(".cm-gutters")).toBeTruthy());
    expect(view.container.querySelector(".ft-markdown-live-preview")).toBeNull();
  });

  it("预览方式把 GFM 表格渲染成真实的 <table>，光标进入表格行时退回源码文本", async () => {
    const value = "普通段落\n\n| 功能 | 说明 |\n| --- | --- |\n| 小红书 | 自动分页 |";
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={onChange}
          resetKey="table-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() => expect(view.container.querySelector(".ft-md-table")).toBeTruthy());

    const table = view.container.querySelector(".ft-md-table");
    expect(table?.querySelectorAll("th")).toHaveLength(2);
    expect(table?.textContent).toContain("小红书");
    expect(table?.textContent).not.toContain("---");

    // 光标移动到表格所在行时，退回显示原始文本，避免破坏直接编辑能力。
    act(() => {
      ref.current!.locateText("小红书");
    });
    await waitFor(() => expect(view.container.querySelector(".ft-md-table")).toBeNull());
    expect(view.container.textContent).toContain("小红书");
    expect(view.container.textContent).toContain("---");
  });

  it("预览方式把围栏代码块渲染成 <pre><code>，光标进入代码行时退回源码文本", async () => {
    const value = "普通段落\n\n```ts\nfunction hello() {\n  return 1;\n}\n```";
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={onChange}
          resetKey="code-fence-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() => expect(view.container.querySelector(".ft-md-codeblock")).toBeTruthy());

    const block = view.container.querySelector(".ft-md-codeblock");
    expect(block?.querySelector("code.language-ts")).toBeTruthy();
    expect(block?.textContent).toContain("function hello()");
    expect(view.container.textContent).not.toContain("```");

    // 光标移动到代码块内部时，退回显示原始文本（含围栏标记），保留直接编辑能力。
    act(() => {
      ref.current!.locateText("return 1");
    });
    await waitFor(() => expect(view.container.querySelector(".ft-md-codeblock")).toBeNull());
    expect(view.container.textContent).toContain("```ts");
  });

  it("预览方式把无序列表的标记替换成实心圆点，光标进入该行时退回原始的 - / * / +", async () => {
    // 光标默认停在文档开头（第一行），刻意加一行普通文字，避免它正好落在列表上。
    const value = "普通段落\n\n- 第一项\n- 第二项\n* 第三项";
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={onChange}
          resetKey="list-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() => expect(view.container.querySelectorAll(".ft-md-bullet")).toHaveLength(3));
    expect(view.container.querySelectorAll(".ft-md-bullet")[0]?.textContent).toBe("•");
    expect(view.container.textContent).not.toMatch(/[-*]\s*第一项/);

    // 光标移动到某一项时，退回显示原始的 Markdown 标记，保留直接编辑能力。
    act(() => {
      ref.current!.locateText("第一项");
    });
    await waitFor(() => expect(view.container.querySelectorAll(".ft-md-bullet")).toHaveLength(2));
    expect(view.container.textContent).toContain("- 第一项");
  });

  it("预览方式把任务列表渲染成可点击的复选框，点击直接切换文档里的勾选状态", async () => {
    const value = "普通段落\n\n- [ ] 待办一\n- [x] 已完成";
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={onChange}
          resetKey="task-list-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() =>
      expect(view.container.querySelectorAll(".ft-md-task-checkbox")).toHaveLength(2),
    );
    expect(view.container.textContent).not.toMatch(/\[[ xX]\]/);

    const checkboxes = view.container.querySelectorAll<HTMLInputElement>(".ft-md-task-checkbox");
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);

    // 点击未勾选的复选框，应该直接改文档，把对应的空格换成 x，且不进入源码模式。
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenLastCalledWith("普通段落\n\n- [x] 待办一\n- [x] 已完成");
    await waitFor(() =>
      expect(
        view.container.querySelectorAll<HTMLInputElement>(".ft-md-task-checkbox")[0].checked,
      ).toBe(true),
    );

    // 光标移进那一行时，退回显示原始的 - [x] 文本，保留直接编辑能力。
    act(() => {
      ref.current!.locateText("待办一");
    });
    await waitFor(() =>
      expect(view.container.querySelectorAll(".ft-md-task-checkbox")).toHaveLength(1),
    );
    expect(view.container.textContent).toContain("- [x] 待办一");
  });

  it("预览方式把整行的图片渲染成 <img>，光标进入该行时退回源码文本", async () => {
    const ref = createRef<EditorApi>();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={`普通段落\n\n![封面](${RED_PIXEL})`}
          onChange={vi.fn()}
          resetKey="image-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() => expect(view.container.querySelector(".ft-md-image img")).toBeTruthy());

    const img = view.container.querySelector<HTMLImageElement>(".ft-md-image img")!;
    expect(img.getAttribute("src")).toBe(RED_PIXEL);
    expect(img.alt).toBe("封面");
    expect(view.container.textContent).not.toContain("![封面]");

    // 光标移进那一行时退回源码，保留直接编辑能力。
    act(() => {
      ref.current!.locateText("封面");
    });
    await waitFor(() => expect(view.container.querySelector(".ft-md-image")).toBeNull());
    expect(view.container.textContent).toContain("![封面]");
  });

  it("预览方式把正文里的图片引用换成图片库里的那张图", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();
    __resetImageCacheForTests();

    const imageRef = await saveImageDataUrl(RED_PIXEL, 1, 1);
    expect(imageRef).toBeTruthy();

    const ref = createRef<EditorApi>();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={`普通段落\n\n![插图](${imageRef})`}
          onChange={vi.fn()}
          resetKey="image-ref-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() =>
      expect(
        view.container.querySelector<HTMLImageElement>(".ft-md-image img")?.getAttribute("src"),
      ).toBe(RED_PIXEL),
    );
    // 正文里存的仍然是那条短引用，换的只是显示。
    expect(ref.current!.getValue()).toContain(imageRef);
  });

  it("预览方式按 width / align 排版图片，点一下就把光标放进那一行", async () => {
    const ref = createRef<EditorApi>();
    const value = `普通段落\n\n<p align="right"><img src="${RED_PIXEL}" alt="配图" width="50%"></p>`;
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={vi.fn()}
          resetKey="image-layout-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    await waitFor(() => expect(view.container.querySelector(".ft-md-image")).toBeTruthy());

    const box = view.container.querySelector<HTMLElement>(".ft-md-image")!;
    expect(box.style.textAlign).toBe("right");
    expect(box.querySelector("img")!.style.width).toBe("50%");

    // 块级 widget 上的点击，CodeMirror 默认会把光标落到图片外面，图片工具条就够不着这张图。
    fireEvent.mouseDown(box, { button: 0 });
    await waitFor(() => expect(view.container.querySelector(".ft-md-image")).toBeNull());
    expect(ref.current!.getImageAtCursor()).toMatchObject({
      alt: "配图",
      width: 50,
      align: "right",
    });
  });

  it("图片和文字挤在同一行时保持源码，不把整行换成图片", async () => {
    const ref = createRef<EditorApi>();
    const value = `普通段落\n\n![独占](${RED_PIXEL})\n\n夹在文字里 ![混排](${RED_PIXEL}) 的图`;
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={value}
          onChange={vi.fn()}
          resetKey="image-inline-preview-test"
          ariaLabel="编辑区"
          mode="preview"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    // 独占一行的那张换成了图片，混排那行原样留着——整行替换会把旁边的文字一起吃掉。
    await waitFor(() => expect(view.container.querySelectorAll(".ft-md-image")).toHaveLength(1));
    expect(view.container.querySelector(".ft-md-image img")?.getAttribute("alt")).toBe("独占");
    expect(view.container.textContent).toContain("夹在文字里");
    expect(view.container.textContent).toContain("混排");
  });

  it("达到双重硬上限后阻止增加输入，但允许删除和缩短超限文档", async () => {
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    const view = render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value="甲乙丙丁"
          onChange={onChange}
          resetKey="input-limit-test"
          ariaLabel="编辑区"
          inputLimits={{ words: 3, chars: 10 }}
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    act(() => ref.current!.replaceDocument("甲乙丙丁戊"));
    expect(ref.current!.getValue()).toBe("甲乙丙丁");
    expect(onChange).not.toHaveBeenCalled();

    act(() => ref.current!.replaceDocument("甲乙丙"));
    expect(ref.current!.getValue()).toBe("甲乙丙");
    expect(onChange).toHaveBeenLastCalledWith("甲乙丙");

    view.rerender(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value="1234567890"
          onChange={onChange}
          resetKey="character-limit-test"
          ariaLabel="编辑区"
          inputLimits={{ words: 100, chars: 10 }}
        />
      </div>,
    );

    await waitFor(() => expect(ref.current!.getValue()).toBe("1234567890"));
    act(() => ref.current!.replaceDocument("12345678901"));
    expect(ref.current!.getValue()).toBe("1234567890");
  });
});
