import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/components/providers/app-providers";
import { SettingsDialog } from "@/components/workbench/settings-dialog";

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

describe("设置弹框", () => {
  it("用弹框和子菜单收拢全局设置", () => {
    render(
      <AppProviders>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </AppProviders>,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /设置|Settings/ })).toBeTruthy();

    for (const name of [
      /外观|Appearance/,
      /用户资料|Profile/,
      /^(AI 配置|AI)$/,
      /提示词配置|Prompts/,
      /本地数据|Local data/,
      /关于|About/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("外观默认打开，创作者资料可在子菜单中编辑", () => {
    render(
      <AppProviders>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </AppProviders>,
    );

    expect(screen.getByRole("button", { name: /跟随系统|System/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /用户资料|Profile/ }));
    expect(screen.getByLabelText(/用户名|Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Slogan/)).toBeTruthy();
  });

  it("支持从头像入口直接打开用户资料设置", () => {
    render(
      <AppProviders>
        <SettingsDialog open initialSection="profile" onOpenChange={vi.fn()} />
      </AppProviders>,
    );

    expect(screen.getByLabelText(/用户名|Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Slogan/)).toBeTruthy();
  });

  it("未配置 AI 时，AI 配置分区显示告警点", () => {
    render(
      <AppProviders>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </AppProviders>,
    );

    const aiNav = screen.getByRole("button", { name: /^(AI 配置|AI)$/ });
    expect(aiNav.querySelector(".bg-warning")).toBeTruthy();

    const otherNav = screen.getByRole("button", { name: /外观|Appearance/ });
    expect(otherNav.querySelector(".bg-warning")).toBeNull();
  });
});
