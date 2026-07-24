import { beforeEach, describe, expect, it } from "vitest";

import { readRecord, StorageKey, writeRecord } from "@/lib/storage";
import {
  createSavedCustomTheme,
  emptyCustomThemeLibrary,
  parseCustomThemeLibrary,
} from "@/lib/themes/custom";
import { parseWechatStyle, wechatStyleFromTheme, type WechatStyle } from "@/lib/themes/wechat";
import { parseXhsStyle, xhsStyleFromTheme } from "@/lib/themes/xhs";

describe("自定义主题本地持久化", () => {
  beforeEach(() => localStorage.clear());

  it("小红书保存完整样式快照并能从 localStorage 恢复", () => {
    const style = {
      ...xhsStyleFromTheme("forest"),
      fontSize: 48,
      accentColor: "#123456",
    };
    const saved = createSavedCustomTheme("我的森林", style);
    writeRecord(StorageKey.xhsThemes, { selectedId: saved.id, themes: [saved] });

    const restored = readRecord(
      StorageKey.xhsThemes,
      (raw) => parseCustomThemeLibrary(raw, parseXhsStyle),
      emptyCustomThemeLibrary(),
    );

    expect(restored.found).toBe(true);
    expect(restored.value.selectedId).toBe(saved.id);
    expect(restored.value.themes[0]).toMatchObject({
      name: "我的森林",
      style: { themeId: "forest", fontSize: 48, accentColor: "#123456" },
    });
  });

  it("公众号主题库与小红书分开存储", () => {
    const saved = createSavedCustomTheme("公众号蓝", {
      ...wechatStyleFromTheme("ocean"),
      pagePadding: 40,
    });
    writeRecord(StorageKey.wechatThemes, { selectedId: saved.id, themes: [saved] });

    expect(localStorage.getItem(StorageKey.xhsThemes)).toBeNull();
    expect(
      readRecord(
        StorageKey.wechatThemes,
        (raw) => parseCustomThemeLibrary(raw, parseWechatStyle),
        emptyCustomThemeLibrary<WechatStyle>(),
      ).value.themes[0].style.pagePadding,
    ).toBe(40);
  });

  it("损坏、重名 id 和空名称会逐项跳过", () => {
    const style = xhsStyleFromTheme("classic");
    const parsed = parseCustomThemeLibrary(
      {
        selectedId: "custom-good",
        themes: [
          { id: "custom-good", name: "可用", style },
          { id: "custom-good", name: "重复", style },
          { id: "fake", name: "伪造", style },
          { id: "custom-empty", name: "   ", style },
        ],
      },
      parseXhsStyle,
    );

    expect(parsed).toEqual({
      selectedId: "custom-good",
      themes: [{ id: "custom-good", name: "可用", style }],
    });
  });
});
