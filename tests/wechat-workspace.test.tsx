import { render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { AiProvider } from "@/components/providers/ai-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { StyleProvider } from "@/components/providers/style-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WechatWorkspace } from "@/components/workbench/wechat-workspace";

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

describe("公众号内容编辑器", () => {
  it("限制内容区高度，让长内容在编辑器内滚动", () => {
    render(
      <PrefsProvider>
        <StyleProvider>
          <UserProfileProvider>
            <AiProvider>
              <TooltipProvider>
                <WechatWorkspace
                  activeTab="content"
                  onActiveTabChange={vi.fn()}
                  contentMode="text"
                  onContentModeChange={vi.fn()}
                  editorRef={{ current: null } as RefObject<EditorApi | null>}
                  content={Array.from({ length: 200 }, (_, index) => `第 ${index + 1} 行`).join(
                    "\n",
                  )}
                  onContentChange={vi.fn()}
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

    const toolbar = screen.getByRole("toolbar");
    const contentPanel = toolbar.parentElement?.parentElement;
    const header = screen.getByTestId("wechat-workspace-header");
    const modeSwitcher = screen.getByRole("group", { name: /Editor view|编辑器显示方式/ });

    expect(header.contains(modeSwitcher)).toBe(false);
    expect(toolbar.lastElementChild?.lastElementChild).toBe(modeSwitcher);
    expect(screen.getByRole("button", { name: /^Text$|^文本$/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(contentPanel?.classList.contains("flex")).toBe(true);
    expect(contentPanel?.classList.contains("min-h-0")).toBe(true);
    expect(contentPanel?.classList.contains("overflow-hidden")).toBe(true);
    expect(document.querySelector(".cm-scroller")).toBeTruthy();
  });

  it("把版式和元素设置统一归入排版入口", () => {
    const view = render(
      <PrefsProvider>
        <StyleProvider>
          <UserProfileProvider>
            <AiProvider>
              <TooltipProvider>
                <WechatWorkspace
                  activeTab="typography"
                  onActiveTabChange={vi.fn()}
                  contentMode="text"
                  onContentModeChange={vi.fn()}
                  editorRef={{ current: null } as RefObject<EditorApi | null>}
                  content=""
                  onContentChange={vi.fn()}
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

    const header = screen.getByTestId("wechat-workspace-header");
    expect(header.querySelectorAll("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Cover|封面/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Typography|排版/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Elements|元素/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /Body typography|正文排版/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Text elements|文字元素/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Lists$|^列表$/ })).toBeTruthy();
    expect(
      view.container.querySelectorAll(
        '[data-setting-example^="wechat-"]:not([data-setting-example=""])',
      ),
    ).toHaveLength(6);
  });

  it("提供横版和方形公众号封面工作台", () => {
    render(
      <PrefsProvider>
        <StyleProvider>
          <UserProfileProvider>
            <AiProvider>
              <TooltipProvider>
                <WechatWorkspace
                  activeTab="cover"
                  onActiveTabChange={vi.fn()}
                  contentMode="text"
                  onContentModeChange={vi.fn()}
                  editorRef={{ current: null } as RefObject<EditorApi | null>}
                  content="# 正文"
                  onContentChange={vi.fn()}
                  onSelectionChange={vi.fn()}
                  resetKey="test"
                  savePending={false}
                  documentTitle="自动封面标题"
                  docBaseName="测试文章"
                />
              </TooltipProvider>
            </AiProvider>
          </UserProfileProvider>
        </StyleProvider>
      </PrefsProvider>,
    );

    expect(screen.getAllByText(/900 × 383/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500 × 500/).length).toBeGreaterThan(0);
    expect(
      screen
        .getByLabelText(/Use article title automatically|自动使用文章标题/)
        .getAttribute("data-state"),
    ).toBe("unchecked");
    expect(screen.getByRole("button", { name: /Right|右对齐/ })).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Download both covers as ZIP|打包下载横版与方形封面/,
      }),
    ).toBeTruthy();
  });
});
