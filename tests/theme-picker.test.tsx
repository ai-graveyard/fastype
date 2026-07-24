import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { ThemePicker } from "@/components/workbench/style-drawers";
import { WECHAT_THEMES } from "@/lib/themes/wechat";
import { XHS_THEMES } from "@/lib/themes/xhs";
import { xhsStyleFromTheme } from "@/lib/themes/xhs";

function withPrefs(node: React.ReactNode) {
  return render(<PrefsProvider>{node}</PrefsProvider>);
}

describe("LovType 主题选择卡", () => {
  it("小红书展示七张带真实色板缩略图的主题卡", () => {
    const onChange = vi.fn();
    const view = withPrefs(
      <ThemePicker
        themes={XHS_THEMES}
        value="classic"
        onChange={onChange}
        label="主题"
        variant="xhs"
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(
      screen.getByRole("radio", { name: /Classic|经典/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(view.container.querySelectorAll('[data-theme-variant="xhs"]')).toHaveLength(7);
    expect(view.container.querySelector('[data-theme-preview="deepsea"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Deep Sea|深海/ }));
    expect(onChange).toHaveBeenCalledWith("deepsea");
  });

  it("公众号展示 LovType 的标题式缩略卡", () => {
    const view = withPrefs(
      <ThemePicker
        themes={WECHAT_THEMES}
        value="sunset"
        onChange={vi.fn()}
        label="主题"
        variant="wechat"
        showLabel={false}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(view.container.querySelectorAll('[data-theme-variant="wechat"]')).toHaveLength(7);
    expect(screen.getAllByText("Title")).toHaveLength(7);
    expect(
      screen.getByRole("radio", { name: /Deep Sea|深海/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("展示 LovType 自定义主题入口、已保存主题和本地主题操作", () => {
    const onCreate = vi.fn();
    const onApply = vi.fn();
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const customTheme = {
      id: "custom-local",
      name: "我的主题",
      style: { ...xhsStyleFromTheme("rose"), accentColor: "#123456" },
    };
    withPrefs(
      <ThemePicker
        themes={XHS_THEMES}
        value="custom"
        onChange={vi.fn()}
        label="主题"
        variant="xhs"
        customThemes={[customTheme]}
        onCreateCustomTheme={onCreate}
        onApplyCustomTheme={onApply}
        onSaveCustomTheme={onSave}
        onDeleteCustomTheme={onDelete}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(9);
    fireEvent.click(screen.getByRole("radio", { name: /自定义|Custom/ }));
    expect(onCreate).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByPlaceholderText(/起个名字|Name this theme/), {
      target: { value: "常用主题" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存主题|Save theme/ }));
    expect(onSave).toHaveBeenCalledWith("常用主题");

    fireEvent.click(screen.getByRole("radio", { name: "我的主题" }));
    expect(onApply).toHaveBeenCalledWith("custom-local");

    fireEvent.click(screen.getByRole("button", { name: /删除自定义主题|Delete custom theme/ }));
    fireEvent.click(screen.getByRole("button", { name: /^删除$|^Delete$/ }));
    expect(onDelete).toHaveBeenCalledWith("custom-local");
  });
});
