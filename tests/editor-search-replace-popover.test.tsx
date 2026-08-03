import { fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorSearchReplacePopover } from "@/components/editor/editor-search-replace-popover";
import type { EditorApi } from "@/components/editor/markdown-editor";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

function createEditorApi(): EditorApi {
  return {
    focus: vi.fn(),
    getValue: vi.fn(() => ""),
    getSelection: vi.fn(() => ({ text: "", from: 0, to: 0 })),
    getSelectionRect: vi.fn(() => null),
    subscribeSelection: vi.fn(() => () => undefined),
    getContextAround: vi.fn(() => ({ before: "", after: "" })),
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    insertAfterSelection: vi.fn(),
    replaceRange: vi.fn(() => true),
    insertAfterRange: vi.fn(() => true),
    toggleWrap: vi.fn(),
    toggleLinePrefix: vi.fn(),
    insertBlock: vi.fn(),
    getImageAtCursor: vi.fn(() => null),
    replaceImage: vi.fn(() => true),
    locateText: vi.fn(() => true),
    getScrollLine: vi.fn(() => 1),
    scrollToLine: vi.fn(),
    subscribeScroll: vi.fn(() => () => undefined),
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    configureSearch: vi.fn(() => ({ current: 1, count: 2 })),
    navigateSearch: vi.fn(() => ({ current: 2, count: 2 })),
    replaceCurrentSearch: vi.fn(() => ({ current: 1, count: 1 })),
    replaceAllSearch: vi.fn(() => ({ current: 0, count: 0 })),
    getSearchStatus: vi.fn(() => ({ current: 1, count: 2 })),
    subscribeSearchPanel: vi.fn(() => () => undefined),
    subscribeSearchUpdate: vi.fn(() => () => undefined),
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

function renderSearch(api = createEditorApi()) {
  render(
    <PrefsProvider>
      <TooltipProvider>
        <EditorSearchReplacePopover editorRef={{ current: api } as RefObject<EditorApi | null>} />
      </TooltipProvider>
    </PrefsProvider>,
  );
  return api;
}

describe("编辑器搜索与替换浮层", () => {
  it("打开后显示搜索框，并可展开替换操作", () => {
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: /搜索与替换|Find and replace/ }));
    expect(screen.getByPlaceholderText(/搜索文本|Search text/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /展开替换|Expand replace/ }));
    expect(screen.getByPlaceholderText(/替换为|Replace with/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /替换当前项|Replace current/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /全部替换|Replace all/ })).toBeTruthy();
  });

  it("输入搜索词后显示匹配进度并支持导航", () => {
    const api = renderSearch();

    fireEvent.click(screen.getByRole("button", { name: /搜索与替换|Find and replace/ }));
    fireEvent.change(screen.getByPlaceholderText(/搜索文本|Search text/), {
      target: { value: "FasType" },
    });

    expect(screen.getByText("1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /下一个匹配|Next match/ }));
    expect(api.navigateSearch).toHaveBeenCalledWith("next");
    expect(screen.getByText("2/2")).toBeTruthy();
  });
});
