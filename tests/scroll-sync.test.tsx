import { act, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useScrollSync } from "@/hooks/use-scroll-sync";
import { renderMarkdown } from "@/lib/markdown/parse";

/**
 * jsdom 没有真实布局，getBoundingClientRect 一律返回 0。这里按「块 i 距内容顶部
 * tops[i] 像素」造一份假布局，让 offsetWithin() 算出来的值和真实浏览器一致。
 *
 * 脱离文档的元素一律返回 0，和浏览器的行为一致——预览被整段重渲染后，
 * 拿着旧节点算位置会算出什么，测试里要能如实反映出来。
 */
function stubLayout(container: HTMLElement, tops: number[]) {
  container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  const blocks = Array.from(container.querySelectorAll<HTMLElement>("[data-source-line]"));
  blocks.forEach((block, index) => {
    // 容器滚动多少，块在视口里就上移多少。
    block.getBoundingClientRect = () =>
      ({ top: block.isConnected ? tops[index] - container.scrollTop : 0 }) as DOMRect;
    Object.defineProperty(block, "offsetHeight", {
      get: () => (block.isConnected ? 100 : 0),
      configurable: true,
    });
  });
  return blocks;
}

function createEditor(overrides: Partial<EditorApi> = {}) {
  const listeners = new Set<() => void>();
  const api = {
    getScrollLine: vi.fn(() => 1),
    scrollToLine: vi.fn(),
    subscribeScroll: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    ...overrides,
  } as unknown as EditorApi;
  return { api, emitScroll: () => listeners.forEach((listener) => listener()) };
}

function Harness({
  editor,
  preview,
  contentKey,
}: {
  editor: EditorApi;
  preview: HTMLElement;
  contentKey: string;
}) {
  const editorRef = React.useRef<EditorApi | null>(editor);
  const getPreview = React.useCallback(() => preview, [preview]);
  useScrollSync(editorRef, getPreview, true, contentKey);
  return null;
}

/** 推进一帧 requestAnimationFrame，让 hook 里排队的同步真正跑起来。 */
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

// 四个块，源码行 1 / 3 / 5 / 7，预览里分别落在 0 / 200 / 400 / 600 像素。
const SOURCE = "# 标题\n\n第一段\n\n第二段\n\n第三段";
const TOPS = [0, 200, 400, 600];

let preview: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  preview = document.createElement("div");
  preview.innerHTML = renderMarkdown(SOURCE).html;
  document.body.appendChild(preview);
  stubLayout(preview, TOPS);
});

describe("useScrollSync", () => {
  it("编辑器滚动时把预览带到对应的块", async () => {
    const { api, emitScroll } = createEditor({ getScrollLine: vi.fn(() => 5) });
    render(<Harness editor={api} preview={preview} contentKey={SOURCE} />);
    await nextFrame();

    act(() => emitScroll());
    await nextFrame();

    // 第 5 行是第三个块，正好落在它的顶部。
    expect(preview.scrollTop).toBe(400);
  });

  it("停在块与块之间时按比例插值，不是一跳一跳", async () => {
    // 第 4 行在第 3 行和第 5 行正中间，对应像素也应落在 200 和 400 的中间。
    const { api, emitScroll } = createEditor({ getScrollLine: vi.fn(() => 4) });
    render(<Harness editor={api} preview={preview} contentKey={SOURCE} />);
    await nextFrame();

    act(() => emitScroll());
    await nextFrame();

    expect(preview.scrollTop).toBe(300);
  });

  it("预览滚动时把编辑器带到对应的行", async () => {
    const { api } = createEditor();
    render(<Harness editor={api} preview={preview} contentKey={SOURCE} />);
    await nextFrame();

    preview.scrollTop = 400;
    act(() => preview.dispatchEvent(new Event("scroll")));
    await nextFrame();

    expect(api.scrollToLine).toHaveBeenCalledWith(5);
  });

  it("一侧驱动期间不接受另一侧的回声，两边不会互相追", async () => {
    const { api, emitScroll } = createEditor({ getScrollLine: vi.fn(() => 5) });
    render(<Harness editor={api} preview={preview} contentKey={SOURCE} />);
    await nextFrame();

    // 编辑器驱动 → 预览被动滚动 → 预览的 scroll 事件不应该再回头驱动编辑器。
    act(() => emitScroll());
    await nextFrame();
    act(() => preview.dispatchEvent(new Event("scroll")));
    await nextFrame();

    expect(api.scrollToLine).not.toHaveBeenCalled();
  });

  it("预览整段重渲染后仍然能同步（导出长图会重设 innerHTML）", async () => {
    const { api } = createEditor();
    render(<Harness editor={api} preview={preview} contentKey={SOURCE} />);
    await nextFrame();

    // 先确认正常联动
    preview.scrollTop = 400;
    act(() => preview.dispatchEvent(new Event("scroll")));
    await nextFrame();
    expect(api.scrollToLine).toHaveBeenCalledWith(5);
    vi.mocked(api.scrollToLine).mockClear();

    // 正文没变、DOM 却被换了一整棵：缓存里的块全部失联，位置只能当场重采。
    preview.innerHTML = renderMarkdown(SOURCE).html;
    stubLayout(preview, TOPS);
    preview.scrollTop = 200;
    act(() => preview.dispatchEvent(new Event("scroll")));
    await nextFrame();

    expect(api.scrollToLine).toHaveBeenCalledWith(3);
  });

  it("没有行号标记时两边都不动，宁可不同步也不滚到错的地方", async () => {
    const bare = document.createElement("div");
    bare.innerHTML = "<p>没有 data-source-line</p>";
    bare.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    document.body.appendChild(bare);

    const { api, emitScroll } = createEditor({ getScrollLine: vi.fn(() => 5) });
    render(<Harness editor={api} preview={bare} contentKey="bare" />);
    await nextFrame();

    act(() => emitScroll());
    await nextFrame();

    expect(bare.scrollTop).toBe(0);
    expect(api.scrollToLine).not.toHaveBeenCalled();
  });
});
