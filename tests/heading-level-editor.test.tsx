import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { HeadingLevelEditor } from "@/components/workbench/style-drawers";
import { DEFAULT_XHS_HEADINGS } from "@/lib/themes/xhs";

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

function withPrefs(node: React.ReactNode) {
  return render(<PrefsProvider>{node}</PrefsProvider>);
}

describe("标题级别编辑器", () => {
  it("不再展示字号百分比，右上角改为恢复默认样式按钮", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    withPrefs(
      <HeadingLevelEditor
        level="h1"
        value={{ ...DEFAULT_XHS_HEADINGS.h1, scale: 1.9 }}
        accentColor="#3b82f6"
        textColor="#1a1a1a"
        onChange={onChange}
        onReset={onReset}
      />,
    );

    expect(screen.queryByText("190%")).toBeNull();
    const resetButton = screen.getByRole("button", {
      name: /Reset to the current theme|恢复当前主题默认样式/,
    });
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("不传 onReset 时不渲染重置按钮", () => {
    withPrefs(
      <HeadingLevelEditor
        level="h2"
        value={DEFAULT_XHS_HEADINGS.h2}
        accentColor="#3b82f6"
        textColor="#1a1a1a"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Reset to the current theme|恢复当前主题默认样式/ }),
    ).toBeNull();
  });
});
