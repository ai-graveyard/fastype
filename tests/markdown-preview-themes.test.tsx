import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarkdownPreview } from "@/components/workbench/markdown-preview";
import {
  MARKDOWN_PREVIEW_MORE_THEMES,
  MARKDOWN_PREVIEW_QUICK_THEMES,
  MARKDOWN_PREVIEW_THEMES,
  isMarkdownPreviewTheme,
} from "@/lib/themes/markdown";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => localStorage.clear());

function renderPreview() {
  return render(
    <PrefsProvider>
      <TooltipProvider>
        <MarkdownPreview
          html="<p>hi</p>"
          exporting={false}
          onExport={vi.fn()}
          onCopyStyled={vi.fn()}
          onExportHtml={vi.fn()}
          onPrint={vi.fn()}
        />
      </TooltipProvider>
    </PrefsProvider>,
  );
}

function openMoreMenu() {
  const trigger = screen.getByRole("button", { name: /More themes|更多主题/ });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return trigger;
}

describe("Markdown 预览主题", () => {
  it("快捷位只留三个主题，其余进「更多」", () => {
    expect(MARKDOWN_PREVIEW_QUICK_THEMES).toHaveLength(3);
    expect(MARKDOWN_PREVIEW_THEMES).toEqual([
      ...MARKDOWN_PREVIEW_QUICK_THEMES,
      ...MARKDOWN_PREVIEW_MORE_THEMES,
    ]);
    expect(MARKDOWN_PREVIEW_MORE_THEMES.length).toBeGreaterThan(1);
    expect(new Set(MARKDOWN_PREVIEW_THEMES).size).toBe(MARKDOWN_PREVIEW_THEMES.length);
    for (const theme of MARKDOWN_PREVIEW_THEMES) expect(isMarkdownPreviewTheme(theme)).toBe(true);
  });

  it("工具栏直接展示三个差异明显的主题，Notion 要点开更多才出现", () => {
    renderPreview();

    const group = screen.getByRole("group", { name: /Preview themes|预览主题/ });
    const quickButtons = Array.from(group.querySelectorAll("button")).filter(
      (button) => !button.hasAttribute("aria-haspopup"),
    );

    expect(quickButtons).toHaveLength(MARKDOWN_PREVIEW_QUICK_THEMES.length);
    expect(quickButtons[0]?.textContent).toBe("GitHub");
    expect(quickButtons[1]?.textContent).toMatch(/Paper|纸张/);
    expect(quickButtons[2]?.textContent).toMatch(/Night|夜读/);
    expect(screen.queryByText("Notion")).toBeNull();
    expect(screen.getByRole("button", { name: /More themes|更多主题/ }).textContent).toMatch(
      /More|更多/,
    );
  });

  it("从更多里选中的主题会应用到预览并占用触发器文案", async () => {
    renderPreview();
    openMoreMenu();

    const item = await screen.findByRole("menuitemradio", { name: /Ink|水墨/ });
    fireEvent.click(item);

    await waitFor(() =>
      expect(document.querySelector(".md-preview")?.className).toContain("md-theme-ink"),
    );
    expect(screen.getByRole("button", { name: /More themes|更多主题/ }).textContent).toMatch(
      /Ink|水墨/,
    );
  });

  it("更多菜单列出全部非快捷主题", async () => {
    renderPreview();
    openMoreMenu();

    const items = await screen.findAllByRole("menuitemradio");
    const expected = [/^Notion$/, /Ink|水墨/, /Sakura|樱色/, /Mint|薄荷/, /Terminal|终端/];

    expect(items).toHaveLength(MARKDOWN_PREVIEW_MORE_THEMES.length);
    expect(items).toHaveLength(expected.length);
    items.forEach((item, index) => expect(item.textContent).toMatch(expected[index]!));
  });
});
