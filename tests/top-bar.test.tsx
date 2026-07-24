import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/components/providers/app-providers";
import { useAi } from "@/components/providers/ai-provider";
import { TopBar } from "@/components/workbench/top-bar";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";

function AiTestControls() {
  const { setConfig, clearConfig } = useAi();
  return (
    <>
      <button type="button" onClick={clearConfig}>
        reset AI
      </button>
      <button
        type="button"
        onClick={() =>
          setConfig({
            ...DEFAULT_AI_CONFIG,
            baseUrl: "https://api.example.com/v1",
            apiKey: "sk-test",
            model: "test-model",
          })
        }
      >
        configure AI
      </button>
    </>
  );
}

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
});

afterAll(() => vi.unstubAllGlobals());

describe("顶部栏", () => {
  it("保留 Logo 的旋转放大与离开复原动画", () => {
    render(
      <AppProviders>
        <TopBar view="xhs" onViewChange={vi.fn()} onOpenSettings={vi.fn()} />
      </AppProviders>,
    );

    const logo = document.querySelector("header img");

    expect(logo?.className).toContain("duration-[3000ms]");
    expect(logo?.className).toContain("hover:rotate-[360deg]");
    expect(logo?.className).toContain("hover:scale-[1.42]");
    expect(logo?.className).toContain("motion-reduce:transition-none");
  });

  it("在最右侧提供专业版入口", () => {
    render(
      <AppProviders>
        <TopBar view="xhs" onViewChange={vi.fn()} onOpenSettings={vi.fn()} />
      </AppProviders>,
    );

    const link = screen.getByRole("link", { name: /使用专业版|Use Pro/ });
    const header = screen.getByRole("banner");

    expect(link.getAttribute("href")).toBe("https://lovtype.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(header.lastElementChild?.lastElementChild).toBe(link);
  });

  it("GitHub 右侧保留主题快捷切换，语言继续只放在设置里", () => {
    render(
      <AppProviders>
        <TopBar view="xhs" onViewChange={vi.fn()} onOpenSettings={vi.fn()} />
      </AppProviders>,
    );

    expect(
      screen.getByRole("button", { name: /打开设置|Open settings|配置 AI|Configure AI/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /切换语言|Toggle language/ })).toBeNull();
    expect(screen.getByRole("button", { name: /切换主题|Toggle theme/ })).toBeTruthy();

    const github = screen.getByRole("link", { name: "GitHub" });
    const theme = screen.getByRole("button", { name: /切换主题|Toggle theme/ });
    expect(github.nextElementSibling).toBe(theme);
  });

  it("未配置 AI 时设置按钮显示告警点，配置完整后消失", () => {
    render(
      <AppProviders>
        <AiTestControls />
        <TopBar view="xhs" onViewChange={vi.fn()} onOpenSettings={vi.fn()} />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "reset AI" }));

    const unconfigured = screen.getByRole("button", { name: /配置 AI|Configure AI/ });
    expect(unconfigured.querySelector(".bg-warning")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "configure AI" }));

    expect(screen.queryByRole("button", { name: /配置 AI|Configure AI/ })).toBeNull();
    const configured = screen.getByRole("button", { name: /打开设置|Open settings/ });
    expect(configured.querySelector(".bg-warning")).toBeNull();
  });
});
