import { act, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor, type EditorApi } from "@/components/editor/markdown-editor";

describe("CodeMirror 搜索与替换", () => {
  it("定位正文时选中目标并保持搜索面板关闭", async () => {
    const ref = createRef<EditorApi>();
    render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value={"开头\n\n需要定位的内容\n\n结尾"}
          onChange={vi.fn()}
          resetKey="locate-test"
          ariaLabel="编辑区"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    const onSearchPanelChange = vi.fn();
    const unsubscribe = ref.current!.subscribeSearchPanel(onSearchPanelChange);

    let located = false;
    act(() => {
      located = ref.current!.locateText("需要定位的内容");
    });

    expect(located).toBe(true);
    expect(ref.current!.getSelection().text).toBe("需要定位的内容");
    expect(onSearchPanelChange).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("统计匹配项，并支持逐个替换与全部替换", async () => {
    const ref = createRef<EditorApi>();
    const onChange = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <MarkdownEditor
          ref={ref}
          value="FasType test FasType"
          onChange={onChange}
          resetKey="search-test"
          ariaLabel="编辑区"
        />
      </div>,
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    let status = { current: 0, count: 0 };
    act(() => {
      status = ref.current!.configureSearch("FasType", "LovType");
    });
    expect(status).toEqual({ current: 1, count: 2 });

    act(() => {
      status = ref.current!.replaceCurrentSearch();
    });
    expect(status).toEqual({ current: 1, count: 1 });
    expect(onChange).toHaveBeenLastCalledWith("LovType test FasType");

    act(() => {
      status = ref.current!.replaceAllSearch();
    });
    expect(status).toEqual({ current: 0, count: 0 });
    expect(onChange).toHaveBeenLastCalledWith("LovType test LovType");
  });
});
