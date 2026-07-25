import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { PreviewStatusBar, StatusBar } from "@/components/workbench/status-bar";

describe("底部状态栏", () => {
  it("左侧显示光标，右侧显示平台限制与全文统计", () => {
    render(
      <PrefsProvider>
        <div>
          <PreviewStatusBar
            summary={<span>3 images · 3:4</span>}
            status={<span>Layout ready</span>}
          />
          <StatusBar
            limitStatus={<span>5040/5000 chars</span>}
            words={100}
            chars={5040}
            lines={12}
            line={2}
            col={4}
            selectionLength={3}
          />
        </div>
      </PrefsProvider>,
    );

    const [previewFooter, editorFooter] = screen.getAllByRole("contentinfo");
    const [cursorStatus, documentStatus] = Array.from(editorFooter.children);

    const [previewSummary, previewStatus] = Array.from(previewFooter.children);
    expect(within(previewSummary as HTMLElement).getByText("3 images · 3:4")).toBeTruthy();
    expect(within(previewStatus as HTMLElement).getByText("Layout ready")).toBeTruthy();
    expect(previewStatus.classList.contains("ml-auto")).toBe(true);
    expect(within(previewFooter).queryByText(/(?:Ln|行) 2/)).toBeNull();
    expect(within(cursorStatus as HTMLElement).getByText(/(?:Ln|行) 2/)).toBeTruthy();
    expect(within(cursorStatus as HTMLElement).getByText(/3 (?:chars selected|字符)/)).toBeTruthy();
    expect(within(documentStatus as HTMLElement).getByText("5040/5000 chars")).toBeTruthy();
    expect(within(documentStatus as HTMLElement).getByText(/100 (words|字)/)).toBeTruthy();
    expect(within(documentStatus as HTMLElement).getByText(/5040 (chars|字符)/)).toBeTruthy();
    expect(within(documentStatus as HTMLElement).getByText(/12 (lines|行)/)).toBeTruthy();
    expect(within(documentStatus as HTMLElement).queryByText(/(?:Ln|行) 2/)).toBeNull();
    expect(
      within(documentStatus as HTMLElement).queryByText(/3 (?:chars selected|字符)/),
    ).toBeNull();
  });
});
