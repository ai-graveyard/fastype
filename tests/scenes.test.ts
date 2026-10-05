import { describe, expect, it } from "vitest";
import { SCENES, sceneXhsStyle, sceneWechatStyle, sceneWechatCover } from "@/lib/themes/scenes";
import { DEFAULT_XHS_STYLE, parseXhsStyle } from "@/lib/themes/xhs";
import { DEFAULT_WECHAT_STYLE, parseWechatStyle } from "@/lib/themes/wechat";
import { DEFAULT_WECHAT_COVER, parseWechatCover } from "@/lib/wechat-cover";
import { parsePrefs } from "@/lib/prefs";

describe("场景模板与编辑偏好", () => {
  it.each(SCENES)("$id 模板可持久化且保留已有内容", (scene) => {
    const current = {
      ...DEFAULT_XHS_STYLE,
      cover: { ...DEFAULT_XHS_STYLE.cover, text: "我的封面" },
      bodyTitleOverride: "我的标题",
      identifier: {
        ...DEFAULT_XHS_STYLE.identifier,
        position: "bottom-right" as const,
        scale: 1.25,
        showDate: false,
      },
    };
    const xhs = sceneXhsStyle(scene.id, current);
    expect(parseXhsStyle(xhs)).toEqual(xhs);
    expect(xhs.cover.text).toBe("我的封面");
    expect(xhs.bodyTitleOverride).toBe("我的标题");
    expect(xhs.cover.enabled).toBe(true);
    expect(xhs.identifier).toEqual({
      ...current.identifier,
      position: "top-left",
      showOnCover: true,
    });
    const wechat = sceneWechatStyle(scene.id, DEFAULT_WECHAT_STYLE, "zh");
    expect(parseWechatStyle(wechat)).toEqual(wechat);
    const cover = sceneWechatCover(
      scene.id,
      { ...DEFAULT_WECHAT_COVER, title: "自定义封面", subtitle: "副标题" },
      wechat,
    );
    expect(parseWechatCover(cover)).toEqual(cover);
    expect(cover.title).toBe("自定义封面");
  });
  it("旧偏好默认可编辑预览，源码选择可以恢复", () => {
    expect(parsePrefs({})?.platformModes).toEqual({ xhs: "preview", wechat: "preview" });
    expect(parsePrefs({ platformModes: { xhs: "text", wechat: "bad" } })?.platformModes).toEqual({
      xhs: "text",
      wechat: "preview",
    });
  });
});

describe("场景排版与配色独立", () => {
  it.each(SCENES)("$id 换色后保留排版与作者设置，所有配色可持久化", async (scene) => {
    const { SCENE_PALETTES } = await import("@/lib/themes/scenes");
    const baseline = sceneXhsStyle(scene.id, DEFAULT_XHS_STYLE, "classic");
    const wechatBaseline = sceneWechatStyle(scene.id, DEFAULT_WECHAT_STYLE, "zh", "classic");
    for (const palette of SCENE_PALETTES) {
      const xhs = sceneXhsStyle(scene.id, DEFAULT_XHS_STYLE, palette);
      const wechat = sceneWechatStyle(scene.id, DEFAULT_WECHAT_STYLE, "zh", palette);
      expect(parseXhsStyle(xhs)).toEqual(xhs);
      expect(parseWechatStyle(wechat)).toEqual(wechat);
      expect(xhs.headings).toEqual(baseline.headings);
      expect(xhs.fontFamily).toBe(baseline.fontFamily);
      expect(xhs.padding).toBe(baseline.padding);
      expect(xhs.qrCode).toEqual(DEFAULT_XHS_STYLE.qrCode);
      expect(wechat.headings).toEqual(wechatBaseline.headings);
      expect(wechat.fontFamily).toBe(wechatBaseline.fontFamily);
      expect(wechat.pagePadding).toBe(wechatBaseline.pagePadding);
      expect(wechat.identityCard).toEqual(DEFAULT_WECHAT_STYLE.identityCard);
      expect(wechat.tailGuide).toEqual(DEFAULT_WECHAT_STYLE.tailGuide);
    }
  });

  it("同色时仍有清晰层级、紧凑编号、舒展阅读三种排版", () => {
    const [knowledge, checklist, essay] = SCENES.map((scene) =>
      sceneXhsStyle(scene.id, DEFAULT_XHS_STYLE, "classic"),
    );
    expect(new Set([knowledge.background, checklist.background, essay.background]).size).toBe(1);
    expect(knowledge.headings.h2.scale).toBeGreaterThan(checklist.headings.h2.scale);
    expect(checklist.headings.h2.number).toMatchObject({
      enabled: true,
      position: "left",
      opacity: 1,
    });
    expect(checklist.paragraphSpacing).toBeLessThan(knowledge.paragraphSpacing);
    expect(checklist.elements.listSpacing).toBeLessThan(essay.elements.listSpacing);
    expect(essay.fontFamily).toBe("serif");
    expect(essay.padding).toBeGreaterThan(knowledge.padding);
    expect(essay.lineHeight).toBeGreaterThan(knowledge.lineHeight);
  });
});
