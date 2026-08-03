import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { AiProvider } from "@/components/providers/ai-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorPane } from "@/components/workbench/editor-pane";

function renderPane(
  savePending: boolean,
  editorRef: RefObject<EditorApi | null> = { current: null },
) {
  return render(
    <PrefsProvider>
      <AiProvider>
        <TooltipProvider>
          <EditorPane editorRef={editorRef} savePending={savePending}>
            <div>Editor</div>
          </EditorPane>
        </TooltipProvider>
      </AiProvider>
    </PrefsProvider>,
  );
}

/** 只补齐工具栏与浮层会碰到的方法，其余成员本用例用不到。 */
function createEditorApi(value: string): EditorApi {
  return {
    getValue: () => value,
    getSelection: () => ({ text: "", from: 0, to: 0 }),
    getSelectionRect: () => null,
    subscribeSelection: () => () => undefined,
    getImageAtCursor: () => null,
    subscribeSearchPanel: () => () => undefined,
    subscribeSearchUpdate: () => () => undefined,
    getSearchStatus: () => ({ current: 0, count: 0 }),
  } as unknown as EditorApi;
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("编辑器保存状态", () => {
  it("未保存时在工具栏左上角显示橙色 Save 图标", () => {
    renderPane(true);

    const status = screen.getByRole("status", { name: /Unsaved|未保存/ });
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.parentElement?.classList.contains("min-w-0")).toBe(true);

    expect(status.classList.contains("text-orange-500")).toBe(true);
    expect(toolbar.firstElementChild?.firstElementChild).toBe(status);
  });

  it("保存后 Save 图标恢复普通颜色", () => {
    renderPane(false);

    const status = screen.getByRole("status", { name: /Saved|已保存/ });

    expect(status.classList.contains("text-muted-foreground")).toBe(true);
    expect(status.classList.contains("text-orange-500")).toBe(false);
  });

  it("在编辑区右上角显示两个圆形 AI 快捷按钮", () => {
    renderPane(false);

    const humanize = screen.getByRole("button", { name: /Remove AI tone|去 AI 味/ });
    const sensitive = screen.getByRole("button", {
      name: /Remove sensitive terms|去敏感词/,
    });
    expect(humanize.classList.contains("rounded-full")).toBe(true);
    expect(sensitive.classList.contains("rounded-full")).toBe(true);
    const actions = humanize.closest("div.absolute");
    expect(actions?.classList.contains("top-3")).toBe(true);
    expect(actions?.classList.contains("flex-col")).toBe(true);
  });
});

describe("编辑器复制按钮", () => {
  const source = "# 标题\n\n**粗体**和[链接](https://example.com)";

  it("复制全文按钮原样复制 Markdown", async () => {
    const writeText = stubClipboard();
    const editorRef = { current: createEditorApi(source) };
    renderPane(false, editorRef);

    fireEvent.click(screen.getByRole("button", { name: /Copy all|复制全文/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(source));
  });

  it("复制纯文本按钮去掉 Markdown 标记", async () => {
    const writeText = stubClipboard();
    const editorRef = { current: createEditorApi(source) };
    renderPane(false, editorRef);

    fireEvent.click(screen.getByRole("button", { name: /plain text|纯文本/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("标题\n\n粗体和链接"));
  });

  it("正文为空时不写剪贴板", async () => {
    const writeText = stubClipboard();
    const editorRef = { current: createEditorApi("   ") };
    renderPane(false, editorRef);

    fireEvent.click(screen.getByRole("button", { name: /Copy all|复制全文/ }));
    fireEvent.click(screen.getByRole("button", { name: /plain text|纯文本/ }));

    expect(writeText).not.toHaveBeenCalled();
  });
});
