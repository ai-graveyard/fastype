import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RefObject } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { AiProvider } from "@/components/providers/ai-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { StyleProvider } from "@/components/providers/style-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { XhsWorkspace, type XhsWorkspaceTab } from "@/components/workbench/xhs-workspace";
import { DEFAULT_XHS_STYLE, getXhsCanvasSize } from "@/lib/themes/xhs";

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

function renderWorkspace(activeTab: XhsWorkspaceTab, content = "") {
  return render(
    <PrefsProvider>
      <StyleProvider>
        <UserProfileProvider>
          <AiProvider>
            <TooltipProvider>
              <XhsWorkspace
                activeTab={activeTab}
                onActiveTabChange={vi.fn()}
                contentMode="text"
                onContentModeChange={vi.fn()}
                editorRef={{ current: null } as RefObject<EditorApi | null>}
                content={content}
                onContentChange={vi.fn()}
                metadata={{ title: "", content: "", tags: [] }}
                onMetadataChange={vi.fn()}
                onSelectionChange={vi.fn()}
                resetKey="test"
                savePending={false}
              />
            </TooltipProvider>
          </AiProvider>
        </UserProfileProvider>
      </StyleProvider>
    </PrefsProvider>,
  );
}

describe("小红书设置导航", () => {
  it("把图片和内容作为并列的一级模块", () => {
    const view = renderWorkspace("image");

    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getByRole("tab", { name: /^Image$|^图文$/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^Content$|^内容$/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Image body|图片正文/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Text body|正文/ })).toBeNull();
    expect(screen.getByRole("toolbar", { name: /Formatting toolbar|格式工具栏/ })).toBeTruthy();

    view.rerender(
      <PrefsProvider>
        <StyleProvider>
          <UserProfileProvider>
            <AiProvider>
              <TooltipProvider>
                <XhsWorkspace
                  activeTab="content"
                  onActiveTabChange={vi.fn()}
                  contentMode="text"
                  onContentModeChange={vi.fn()}
                  editorRef={{ current: null } as RefObject<EditorApi | null>}
                  content=""
                  onContentChange={vi.fn()}
                  metadata={{ title: "", content: "", tags: [] }}
                  onMetadataChange={vi.fn()}
                  onSelectionChange={vi.fn()}
                  resetKey="test"
                  savePending={false}
                />
              </TooltipProvider>
            </AiProvider>
          </UserProfileProvider>
        </StyleProvider>
      </PrefsProvider>,
    );

    expect(screen.getByRole("textbox", { name: /Title|标题/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Text body|正文/ })).toBeTruthy();
  });

  it("关闭时折叠所有封面选项，打开后才展示", () => {
    const view = renderWorkspace("cover", "# 自动封面标题");
    const coverSwitch = screen.getByRole("switch", { name: /^(Cover|封面)$/ });

    if (coverSwitch.getAttribute("data-state") === "checked") {
      fireEvent.click(coverSwitch);
    }
    expect(coverSwitch.getAttribute("data-state")).toBe("unchecked");
    expect(view.container.querySelector("textarea")).toBeNull();

    fireEvent.click(coverSwitch);
    expect(view.container.querySelector("textarea")).toBeTruthy();
  });

  it("把正文第一个一级标题填入封面文字输入框", () => {
    const view = renderWorkspace("cover", "开场白\n\n# 自动封面标题\n\n正文");
    const coverSwitch = screen.getByRole("switch", { name: /^(Cover|封面)$/ });
    if (coverSwitch.getAttribute("data-state") !== "checked") fireEvent.click(coverSwitch);

    expect(view.container.querySelector("textarea")?.value).toBe("自动封面标题");
    expect(screen.getAllByText("自动封面标题")).toHaveLength(2);
  });

  it("保留封面文字行尾输入的换行", () => {
    const view = renderWorkspace("cover", "# 自动封面标题");
    const coverSwitch = screen.getByRole("switch", { name: /^(Cover|封面)$/ });
    if (coverSwitch.getAttribute("data-state") !== "checked") fireEvent.click(coverSwitch);

    const textarea = view.container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "自动封面标题\n" } });
    expect(textarea.value).toBe("自动封面标题\n");

    fireEvent.change(textarea, { target: { value: "自动封面标题\n第二行" } });
    expect(textarea.value).toBe("自动封面标题\n第二行");
  });

  it("封面默认不添加图形，只有用户点选后才创建并可删除", () => {
    const view = renderWorkspace("cover", "# 图形封面");
    const coverSwitch = screen.getByRole("switch", { name: /^(Cover|封面)$/ });

    expect(view.container.querySelector("[data-cover-graphic]")).toBeNull();
    if (coverSwitch.getAttribute("data-state") !== "checked") fireEvent.click(coverSwitch);

    fireEvent.click(screen.getByRole("button", { name: /Add star|添加星星/ }));
    expect(view.container.querySelectorAll('[data-cover-graphic="star"]')).toHaveLength(1);
    expect(screen.getByText(/Editing: star|正在编辑：星星/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Remove selected graphic|删除当前图形/,
      }),
    );
    expect(view.container.querySelector("[data-cover-graphic]")).toBeNull();
  });

  it("主题配色卡包含恢复默认值，且不再展示导出设置", () => {
    const view = renderWorkspace("theme");

    expect(screen.queryByText(/Export settings|导出设置/)).toBeNull();
    expect(screen.queryByText(/Export size|导出尺寸/)).toBeNull();
    const pageLayoutCard = screen.getByText(/^Page and spacing$|^留白$/).closest("section");
    expect(pageLayoutCard).not.toBeNull();
    expect(within(pageLayoutCard!).getByText(/Page padding|页面内边距/)).toBeTruthy();
    expect(within(pageLayoutCard!).getByRole("slider")).toBeTruthy();
    expect(view.container.querySelector('[data-setting-example="xhs-page-layout"]')).toBeTruthy();

    const themeColorsCard = screen.getByText(/Theme colors|^配色$/).closest("section");
    expect(themeColorsCard).not.toBeNull();
    expect(
      within(themeColorsCard as HTMLElement).getByRole("button", {
        name: /Reset to theme defaults|恢复当前主题默认值/,
      }),
    ).toBeTruthy();

    expect(screen.getByText(/Canvas size|^比例$/)).toBeTruthy();
    expect(view.container.querySelector('[data-setting-example="xhs-canvas"]')).toBeTruthy();
  });

  it("目录随排版设置区可用宽度自动显示或隐藏", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

    rectSpy.mockReturnValue({ width: 500 } as DOMRect);
    const narrowView = renderWorkspace("typography");
    expect(screen.queryByRole("navigation", { name: /目录|Outline/ })).toBeNull();
    narrowView.unmount();

    rectSpy.mockReturnValue({ width: 1200 } as DOMRect);
    const wideView = renderWorkspace("typography");
    expect(screen.getByRole("navigation", { name: /目录|Outline/ })).toBeTruthy();
    wideView.unmount();
  });

  it("把版式和元素设置统一归入排版标签", () => {
    const view = renderWorkspace("typography");

    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getByRole("tab", { name: /Typography|排版/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Elements|元素/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /Persona|人设/ })).toBeTruthy();
    expect(screen.queryByText(/Canvas size|^比例$/)).toBeNull();
    expect(screen.getByRole("heading", { name: /Heading design|标题排版/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Text elements|文字元素/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Lists$|列表元素/ })).toBeTruthy();
    expect(screen.queryByText(/^Page and spacing$|^留白$/)).toBeNull();
    expect(screen.queryByText(/Page padding|页面内边距/)).toBeNull();
    expect(
      view.container.querySelectorAll(
        '[data-setting-example^="xhs-"]:not([data-setting-example=""])',
      ),
    ).toHaveLength(6);
    expect(
      screen.getAllByRole("button", { name: /Reset to the current theme|恢复当前主题默认样式/ }),
    ).toHaveLength(3);

    view.rerender(
      <PrefsProvider>
        <StyleProvider>
          <UserProfileProvider>
            <AiProvider>
              <TooltipProvider>
                <XhsWorkspace
                  activeTab="enhance"
                  onActiveTabChange={vi.fn()}
                  contentMode="text"
                  onContentModeChange={vi.fn()}
                  editorRef={{ current: null } as RefObject<EditorApi | null>}
                  content=""
                  onContentChange={vi.fn()}
                  metadata={{ title: "", content: "", tags: [] }}
                  onMetadataChange={vi.fn()}
                  onSelectionChange={vi.fn()}
                  resetKey="test"
                  savePending={false}
                />
              </TooltipProvider>
            </AiProvider>
          </UserProfileProvider>
        </StyleProvider>
      </PrefsProvider>,
    );

    const identifierHeading = screen.getByRole("heading", {
      name: /User identifier|用户标识/,
    });
    const qrCodeHeading = screen.getByRole("heading", { name: /QR code|二维码/ });
    const footerHeading = screen.getByRole("heading", {
      name: /Page number|页码/,
    });
    expect(identifierHeading.compareDocumentPosition(qrCodeHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(qrCodeHeading.compareDocumentPosition(footerHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText(/Identifier position|标识位置/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bottom right|右下/ })).toBeTruthy();
    const showIdentifierOnCover = screen.getByRole("switch", {
      name: /^(Show on cover|在封面中展示)$/,
    });
    const identifierExample = view.container.querySelector(
      '[data-setting-example="xhs-identifier"]',
    );
    expect(identifierExample).not.toBeNull();
    expect(identifierExample?.classList.contains("border-dashed")).toBe(true);
    expect(identifierExample?.firstElementChild?.textContent).toMatch(/Example preview|示例预览/);
    const canvasSize = getXhsCanvasSize(DEFAULT_XHS_STYLE);
    const identifierCard = identifierExample?.querySelector<HTMLElement>(
      ".overflow-hidden.rounded-lg.border",
    );
    expect(identifierCard).not.toBeNull();
    expect(identifierCard?.style.aspectRatio).toBe(`${canvasSize.width} / ${canvasSize.height}`);
    expect(showIdentifierOnCover.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(showIdentifierOnCover);
    expect(showIdentifierOnCover.getAttribute("data-state")).toBe("checked");

    const qrCodeEnabled = screen.getByRole("switch", {
      name: /^(QR code|二维码)$/,
    });
    fireEvent.click(qrCodeEnabled);
    expect(view.container.querySelector('[data-setting-example="xhs-qr-code"]')).toBeTruthy();
    const showQrCodeOnCover = screen.getByRole("switch", {
      name: /Show QR code on cover|在封面中展示二维码/,
    });
    const qrCodeSection = qrCodeHeading.closest("section");
    expect(qrCodeSection).not.toBeNull();
    expect(
      within(qrCodeSection!)
        .getByRole("button", { name: /Top left|左上/ })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(showQrCodeOnCover.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(showQrCodeOnCover);
    expect(showQrCodeOnCover.getAttribute("data-state")).toBe("checked");

    const showPageNumberOnCover = screen.getByRole("switch", {
      name: /Show page number on cover|在封面中展示页码/,
    });
    expect(view.container.querySelector('[data-setting-example="xhs-page-number"]')).toBeTruthy();
    expect(showPageNumberOnCover.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(showPageNumberOnCover);
    expect(showPageNumberOnCover.getAttribute("data-state")).toBe("checked");
  });

  it("让 1:1 及之后的横向画布示例保持可见", () => {
    renderWorkspace("theme");

    const preview = screen.getByTestId("xhs-canvas-preview");
    const cases = [
      { ratio: "1:1", width: "192px", aspectRatio: "1080 / 1080" },
      { ratio: "4:3", width: "256px", aspectRatio: "1440 / 1080" },
      { ratio: "5:4", width: "240px", aspectRatio: "1350 / 1080" },
      { ratio: "16:9", width: "320px", aspectRatio: "1920 / 1080" },
    ];

    for (const item of cases) {
      fireEvent.click(screen.getByRole("button", { name: item.ratio }));
      expect(preview.style.width).toBe(item.width);
      expect(preview.style.height).toBe("auto");
      expect(preview.style.aspectRatio).toBe(item.aspectRatio);
    }
  });
});
