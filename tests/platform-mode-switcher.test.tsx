import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/components/providers/app-providers";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { PlatformModeSwitcher } from "@/components/workbench/platform-mode-switcher";
import { Workbench } from "@/components/workbench/workbench";

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
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

describe("平台内容编辑器显示方式", () => {
  it("默认突出文本模式，并可切换到预览模式", () => {
    const onChange = vi.fn();

    render(
      <PrefsProvider>
        <PlatformModeSwitcher value="text" onChange={onChange} />
      </PrefsProvider>,
    );

    expect(screen.getByRole("button", { name: /^Text$|^文本$/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Preview|预览/ }).getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /Preview|预览/ }));
    expect(onChange).toHaveBeenCalledWith("preview");
  });

  it("小红书把切换器放在内容编辑器工具栏最右侧，且不控制平台预览", async () => {
    render(
      <AppProviders>
        <Workbench />
      </AppProviders>,
    );

    const workspaceHeader = screen.getByTestId("xhs-workspace-header");
    const editorToolbar = screen.getByRole("toolbar", { name: /Formatting toolbar|格式工具栏/ });
    const modeSwitcher = screen.getByRole("group", { name: /Editor view|编辑器显示方式/ });

    expect(workspaceHeader.classList.contains("h-[53px]")).toBe(true);
    expect(workspaceHeader.firstElementChild?.classList.contains("h-full")).toBe(true);
    expect(workspaceHeader.contains(modeSwitcher)).toBe(false);
    expect(editorToolbar.lastElementChild?.lastElementChild).toBe(modeSwitcher);
    expect(screen.getByRole("button", { name: /^Text$|^文本$/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: /Theme|主题/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Preview(?: area)?|预览区/ })).toBeTruthy();
    expect(document.querySelector(".cm-gutters")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Preview|预览/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Preview|预览/ }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(document.querySelector(".ft-markdown-live-preview")).toBeTruthy();
      expect(document.querySelector(".cm-gutters")).toBeNull();
    });
    expect(screen.getByRole("region", { name: /Preview(?: area)?|预览区/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Theme|主题/ })).toBeTruthy();
  });
});
