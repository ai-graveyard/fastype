import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplitPane } from "@/components/workbench/split-pane";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("可拖动分栏", () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeAll(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver,
    });
  });

  function renderPane(onRatioCommit = vi.fn()) {
    return render(
      <PrefsProvider>
        <TooltipProvider>
          <SplitPane
            preview={<div>preview content</div>}
            editor={<div>editor content</div>}
            ratio={0.4}
            defaultRatio={0.5}
            onRatioCommit={onRatioCommit}
            narrowSide="editor"
            onNarrowChange={vi.fn()}
            previewLabel="Preview region"
            editorLabel="Editor region"
          />
        </TooltipProvider>
      </PrefsProvider>,
    );
  }

  it("始终显示两侧内容且分隔条不包含折叠按钮", () => {
    const { container } = renderPane();

    expect(screen.getByRole("region", { name: "Preview region" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Editor region" })).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
    expect(container.querySelector('[data-slot="split-pane-drag-handle"]')).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("双击分隔条仍能恢复默认比例", () => {
    const onRatioCommit = vi.fn();
    renderPane(onRatioCommit);

    fireEvent.doubleClick(screen.getByRole("separator"));
    expect(onRatioCommit).toHaveBeenCalledWith(0.5);
  });
});
