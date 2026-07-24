import { render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { AiProvider } from "@/components/providers/ai-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorPane } from "@/components/workbench/editor-pane";

function renderPane(savePending: boolean) {
  return render(
    <PrefsProvider>
      <AiProvider>
        <TooltipProvider>
          <EditorPane
            editorRef={{ current: null } as RefObject<EditorApi | null>}
            savePending={savePending}
          >
            <div>Editor</div>
          </EditorPane>
        </TooltipProvider>
      </AiProvider>
    </PrefsProvider>,
  );
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
