import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { WechatPreview } from "@/components/workbench/wechat-preview";
import { DEFAULT_WECHAT_STYLE } from "@/lib/themes/wechat";

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

describe("公众号预览", () => {
  it("在右上角滚到顶部，在右下角滚到底部，并保留左下角缩放控件", () => {
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <WechatPreview
            html="<p>正文</p>"
            style={DEFAULT_WECHAT_STYLE}
            onStyleChange={vi.fn()}
            onNavigateSettings={vi.fn()}
            onCopy={vi.fn()}
            onDownloadHtml={vi.fn()}
            onCopyPlain={vi.fn()}
            copyDisabled={false}
            plainTextCopyDisabled={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const viewport = screen.getByTestId("wechat-preview-scroll");
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: scrollTo });

    const scrollToBottom = screen.getByRole("button", {
      name: /滚到底部|Scroll to bottom/,
    });
    const scrollToTop = screen.getByRole("button", { name: /滚到顶部|Scroll to top/ });
    const zoomOut = screen.getByTitle(/缩小预览|Zoom out/);

    expect(scrollToBottom.classList.contains("bottom-2")).toBe(true);
    expect(scrollToBottom.classList.contains("right-2")).toBe(true);
    expect(scrollToTop.classList.contains("top-2")).toBe(true);
    expect(scrollToTop.classList.contains("right-2")).toBe(true);
    expect(scrollToTop.classList.contains("border")).toBe(false);
    expect(scrollToTop.classList.contains("shadow-md")).toBe(false);
    expect(scrollToTop.classList.contains("h-7")).toBe(true);
    expect(scrollToBottom.classList.contains("h-7")).toBe(true);
    expect(zoomOut.parentElement?.classList.contains("bottom-2")).toBe(true);
    expect(zoomOut.parentElement?.classList.contains("left-2")).toBe(true);

    fireEvent.click(scrollToBottom);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: "smooth" });

    fireEvent.click(scrollToTop);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });
  });
});
