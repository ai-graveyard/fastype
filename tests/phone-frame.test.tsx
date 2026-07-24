import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhoneStatusBar } from "@/components/ui/phone-frame";

describe("手机预览状态栏", () => {
  it("共用小红书样式的时间、Wi-Fi 与 80% 电池", () => {
    render(<PhoneStatusBar />);

    const statusBar = screen.getByTestId("phone-status-bar");
    expect(statusBar.classList.contains("h-7")).toBe(true);
    expect(screen.getByText("14:36")).toBeTruthy();
    expect(screen.getByTestId("phone-battery-icon").getAttribute("viewBox")).toBe("0 0 25 12");
    expect(screen.getByTestId("phone-battery-level").getAttribute("width")).toBe("14.4");
  });

  it("支持跟随内容区的背景色与文字色", () => {
    render(<PhoneStatusBar backgroundColor="#fdfaf5" foregroundColor="#3f3f3f" />);

    const statusBar = screen.getByTestId("phone-status-bar");
    expect(statusBar.style.backgroundColor).toBe("rgb(253, 250, 245)");
    expect(statusBar.style.color).toBe("rgb(63, 63, 63)");
  });
});
