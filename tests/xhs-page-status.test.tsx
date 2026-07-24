import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { XhsPageStatus } from "@/components/workbench/xhs-page-status";

describe("小红书预览状态", () => {
  it("展示图片产物摘要，超过 18 张时使用警告态而不是错误态", () => {
    const onOpenCanvasSettings = vi.fn();
    render(
      <PrefsProvider>
        <XhsPageStatus
          total={20}
          ratio="3:4"
          width={1080}
          height={1440}
          onOpenCanvasSettings={onOpenCanvasSettings}
        />
      </PrefsProvider>,
    );

    expect(screen.getByText(/20 images|共 20 张/)).toBeTruthy();
    const canvasButton = screen.getByRole("button", {
      name: /Open canvas size settings: 3:4, 1080×1440|打开画布尺寸设置：3:4，1080×1440/,
    });
    fireEvent.click(canvasButton);
    expect(onOpenCanvasSettings).toHaveBeenCalledOnce();
    const status = screen.getByText(
      /Over 18 images may publish as video|超过 18 张，发布时可能转为视频/,
    );

    expect(status.getAttribute("data-severity")).toBe("warning");
    expect(status.classList.contains("text-warning")).toBe(true);
    expect(status.classList.contains("text-destructive")).toBe(false);
  });

  it("正常状态显示排版正常", () => {
    render(
      <PrefsProvider>
        <XhsPageStatus
          total={18}
          ratio="4:5"
          width={1080}
          height={1350}
          onOpenCanvasSettings={vi.fn()}
        />
      </PrefsProvider>,
    );

    const status = screen.getByText(/Layout ready|排版正常/);

    expect(status.hasAttribute("data-severity")).toBe(false);
    expect(status.classList.contains("text-warning")).toBe(false);
  });

  it("优先展示图片加载失败", () => {
    render(
      <PrefsProvider>
        <XhsPageStatus
          total={20}
          ratio="3:4"
          width={1080}
          height={1440}
          onOpenCanvasSettings={vi.fn()}
          overflowPages={[3]}
          failedImages={2}
        />
      </PrefsProvider>,
    );

    const status = screen.getByText(/2 images failed to load|2 张图片加载失败/);
    expect(status.getAttribute("data-severity")).toBe("error");
    expect(status.classList.contains("text-destructive")).toBe(true);
  });
});
