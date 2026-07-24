import { describe, expect, it } from "vitest";

import { pageFilename, zipFilename } from "@/lib/export/png";
import {
  baseName,
  ensureMarkdownExtension,
  hasAcceptedExtension,
  readTextFile,
  sanitizeFilename,
} from "@/lib/file";
import { detectLocale, interpolate, translate } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";
import { DEFAULT_PREFS, parseDraft, parsePrefs } from "@/lib/prefs";
import { DEFAULT_USER_PROFILE, parseUserProfile } from "@/lib/user-profile";
import {
  DEFAULT_WECHAT_COVER,
  parseWechatCover,
  wechatCoverFilename,
} from "@/lib/wechat-cover";
import { DEFAULT_MARKDOWN_PREVIEW_THEME } from "@/lib/themes/markdown";
import {
  getWechatTheme,
  parseWechatStyle,
  wechatStyleFromTheme,
  WECHAT_THEMES,
} from "@/lib/themes/wechat";
import { DEFAULT_RATIOS, VIEWS } from "@/lib/types";
import {
  DEFAULT_XHS_STYLE,
  getExportSize,
  getXhsTheme,
  parseXhsStyle,
  XHS_THEMES,
  xhsStyleFromTheme,
} from "@/lib/themes/xhs";

describe("文件名处理", () => {
  it("识别支持的扩展名", () => {
    expect(hasAcceptedExtension("a.md")).toBe(true);
    expect(hasAcceptedExtension("a.MD")).toBe(true);
    expect(hasAcceptedExtension("a.markdown")).toBe(false);
    expect(hasAcceptedExtension("a.txt")).toBe(false);
    expect(hasAcceptedExtension("a.docx")).toBe(false);
    expect(hasAcceptedExtension("a.png")).toBe(false);
  });

  it("清掉路径分隔符和非法字符，但保留中文", () => {
    expect(sanitizeFilename("我的/文章:草稿?.md", "未命名.md")).toBe("我的文章草稿.md");
  });

  it("清空后回落到默认名", () => {
    expect(sanitizeFilename("///", "未命名.md")).toBe("未命名.md");
    expect(sanitizeFilename("   ", "未命名.md")).toBe("未命名.md");
  });

  it("去掉开头的点，避免生成隐藏文件或看起来像路径操作符的名字", () => {
    expect(sanitizeFilename("..ssh", "未命名.md")).toBe("ssh");
    expect(sanitizeFilename(".gitignore", "未命名.md")).toBe("gitignore");
    expect(sanitizeFilename("...", "未命名.md")).toBe("未命名.md");
  });

  it("补全扩展名", () => {
    expect(ensureMarkdownExtension("文章")).toBe("文章.md");
    expect(ensureMarkdownExtension("文章.md")).toBe("文章.md");
    expect(ensureMarkdownExtension("笔记.txt")).toBe("笔记.txt.md");
  });

  it("去掉扩展名得到导出用的基名", () => {
    expect(baseName("我的文章.md")).toBe("我的文章");
    expect(baseName("note.markdown")).toBe("note");
  });

  it("PNG 文件名带原文档名和有序页码", () => {
    expect(pageFilename("我的文章", 0)).toBe("我的文章-xhs-01.png");
    expect(pageFilename("我的文章", 11)).toBe("我的文章-xhs-12.png");
  });

  it("全部图片打包为以原文档命名的 ZIP", () => {
    expect(zipFilename("我的文章")).toBe("我的文章-xhs.zip");
  });
});

describe("readTextFile", () => {
  it("读取 UTF-8 Markdown", async () => {
    const file = new File(["# 你好"], "a.md", { type: "text/markdown" });
    const result = await readTextFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toBe("# 你好");
  });

  it("拒绝不支持的类型，而不是读出乱码", async () => {
    const file = new File(["x"], "a.txt");
    const result = await readTextFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsupportedType");
  });

  it("非 UTF-8 内容明确报错", async () => {
    // 0xff 0xfe 不是合法 UTF-8 序列。
    const file = new File([new Uint8Array([0xff, 0xfe, 0x00])], "a.md");
    const result = await readTextFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("decodeFailed");
  });
});

describe("prefs", () => {
  it("非法比例回落到该视图默认值", () => {
    const prefs = parsePrefs({ ratios: { markdown: 5, xhs: -1, wechat: 0.4 } });
    expect(prefs?.ratios.markdown).toBe(DEFAULT_RATIOS.markdown);
    expect(prefs?.ratios.xhs).toBe(DEFAULT_RATIOS.xhs);
    expect(prefs?.ratios.wechat).toBe(0.4);
  });

  it("三个视图的默认比例符合 PRD", () => {
    expect(DEFAULT_RATIOS.markdown).toBe(0.5);
    expect(DEFAULT_RATIOS.xhs).toBeCloseTo(1 / 3, 5);
    expect(DEFAULT_RATIOS.wechat).toBeCloseTo(1 / 3, 5);
  });

  it("小红书是首个且默认打开的视图，编辑器排在最后", () => {
    expect(VIEWS).toEqual(["xhs", "wechat", "markdown"]);
    expect(DEFAULT_PREFS.lastView).toBe("xhs");
  });

  it("未知语言、主题、视图都回落到默认值", () => {
    const prefs = parsePrefs({
      locale: "fr",
      themeMode: "neon",
      markdownPreviewTheme: "unknown",
      lastView: "tiktok",
    });
    expect(prefs?.locale).toBe(DEFAULT_PREFS.locale);
    expect(prefs?.themeMode).toBe(DEFAULT_PREFS.themeMode);
    expect(prefs?.markdownPreviewTheme).toBe(DEFAULT_MARKDOWN_PREVIEW_THEME);
    expect(prefs?.lastView).toBe(DEFAULT_PREFS.lastView);
  });

  it("保留合法的 Markdown 预览主题", () => {
    expect(parsePrefs({ markdownPreviewTheme: "paper" })?.markdownPreviewTheme).toBe("paper");
  });

  it("草稿缺少正文时视为无效，避免清空现有内容", () => {
    expect(parseDraft({ filename: "a.md" })).toBeNull();
    expect(parseDraft({ filename: "a.md", content: "" })).not.toBeNull();
  });
});

describe("用户资料", () => {
  it("默认使用系统 logo、FasType 和默认 slogan", () => {
    expect(DEFAULT_USER_PROFILE).toEqual({
      avatar: "/fastype-logo.png",
      name: "FasType",
      slogan: "一分钟快速多平台排版",
    });
  });

  it("坏头像与空文本安全回落，合法位图 data URL 保留", () => {
    expect(parseUserProfile({ avatar: "javascript:alert(1)", name: " ", slogan: "" })).toEqual(
      DEFAULT_USER_PROFILE,
    );
    expect(
      parseUserProfile({
        avatar: "data:image/png;base64,AAAA",
        name: "  小林  ",
        slogan: " 专注内容 ",
      }),
    ).toEqual({ avatar: "data:image/png;base64,AAAA", name: "小林", slogan: "专注内容" });
  });
});

describe("公众号封面", () => {
  it("默认不自动使用文章标题，并提供右对齐", () => {
    expect(DEFAULT_WECHAT_COVER.useDocumentTitle).toBe(false);
    expect(parseWechatCover({ align: "right" })?.align).toBe("right");
  });

  it("保留合法本地裁剪图，并夹紧样式设置", () => {
    const cover = parseWechatCover({
      wideImage: "data:image/webp;base64,AAAA",
      squareImage: "javascript:alert(1)",
      overlayOpacity: 9,
      align: "justify",
      position: "bottom",
    });

    expect(cover).toMatchObject({
      wideImage: "data:image/webp;base64,AAAA",
      squareImage: "",
      overlayOpacity: 0.85,
      align: DEFAULT_WECHAT_COVER.align,
      position: "bottom",
    });
  });

  it("横版与方形封面使用清晰的导出文件名", () => {
    expect(wechatCoverFilename("文章", "wide")).toBe("文章-wechat-cover-900x383.png");
    expect(wechatCoverFilename("文章", "square")).toBe("文章-wechat-cover-500x500.png");
  });
});

describe("主题配置", () => {
  it("小红书完整使用 LovType 的七套内置主题", () => {
    const ids = XHS_THEMES.map((theme) => theme.id);
    expect(ids).toEqual(["classic", "elegant", "ocean", "forest", "rose", "dark", "deepsea"]);
  });

  it("公众号完整使用 LovType 的七套内置主题", () => {
    expect(WECHAT_THEMES.map((theme) => theme.id)).toEqual([
      "classic",
      "elegant",
      "ocean",
      "forest",
      "rose",
      "dark",
      "sunset",
    ]);
  });

  it("主题核心色值与 LovType 保持一致", () => {
    expect(getXhsTheme("classic").defaults).toMatchObject({
      background: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#3b82f6",
    });
    expect(getXhsTheme("deepsea").derived).toMatchObject({
      strongColor: "#8fe7ff",
      linkColor: "#67e8f9",
      codeBackground: "#07111a",
      inlineCodeColor: "#7dd3fc",
    });
    expect(getXhsTheme("dark").preview).toEqual({
      pageBackground: "#202333",
      pageBorderColor: "#3a405c",
      titleBackground: "#6f7bf7",
      sectionBackground: "#2a2e42",
    });
    expect(getWechatTheme("sunset").defaults).toMatchObject({
      pageBackground: "#08131d",
      textColor: "#d7e8f3",
      accentColor: "#22c3ee",
    });
    expect(getWechatTheme("sunset").palette.pageBorderColor).toBe("#163247");
  });

  it("旧主题 id 会迁移到最接近的 LovType 主题", () => {
    expect(getXhsTheme("simple").id).toBe("classic");
    expect(getXhsTheme("sunset").id).toBe("deepsea");
    expect(getWechatTheme("aurora").id).toBe("sunset");
    expect(getWechatTheme("deepsea").id).toBe("sunset");
  });

  it("所有主题颜色都是合法十六进制", () => {
    const hex = /^#[0-9a-f]{6}$/i;
    for (const theme of XHS_THEMES) {
      expect(theme.defaults.background, theme.id).toMatch(hex);
      expect(theme.defaults.textColor, theme.id).toMatch(hex);
      expect(theme.defaults.accentColor, theme.id).toMatch(hex);
      expect(theme.derived.mutedColor, theme.id).toMatch(hex);
    }
    for (const theme of WECHAT_THEMES) {
      expect(theme.defaults.textColor, theme.id).toMatch(hex);
      expect(theme.defaults.accentColor, theme.id).toMatch(hex);
    }
  });

  it("未知主题 id 回落到第一个主题", () => {
    expect(getXhsTheme("不存在").id).toBe(XHS_THEMES[0].id);
  });

  it("恢复默认值会丢弃用户改动但保留导出尺寸", () => {
    const custom = { ...xhsStyleFromTheme("classic"), fontSize: 55, exportSizeId: "1620" };
    const reset = xhsStyleFromTheme(custom.themeId, custom.exportSizeId);
    expect(reset.fontSize).toBe(getXhsTheme("classic").defaults.fontSize);
    expect(reset.exportSizeId).toBe("1620");
  });

  it("样式字段越界时被夹回合法区间", () => {
    const style = parseXhsStyle({ themeId: "classic", fontSize: 999, lineHeight: 0.1, padding: -5 });
    expect(style?.fontSize).toBeLessThanOrEqual(60);
    expect(style?.lineHeight).toBeGreaterThanOrEqual(1.3);
    expect(style?.padding).toBeGreaterThanOrEqual(32);
  });

  it("旧版小红书配置会补齐 Lovtype 排版字段", () => {
    const style = parseXhsStyle({ themeId: "classic", fontSize: 36 });
    expect(style?.paragraphSpacing).toBeGreaterThan(0);
    expect(style?.headingTemplate).toBe("classic");
    expect(style?.headings.h1.scale).toBeGreaterThan(style!.headings.h3.scale);
    expect(style?.cover.enabled).toBe(false);
    expect(style?.cover.graphics).toEqual([]);
    expect(style?.pageNumberAlign).toBe("center");
    expect(style?.pageNumberScale).toBe(2.5);
    expect(style?.showPageNumberOnCover).toBe(false);
    expect(style?.identifier).toEqual({
      enabled: true,
      showOnCover: false,
      position: "top-left",
      scale: 2,
      showDate: true,
      avatarBorder: false,
      badge: "wand-sparkles",
      badgeEnabled: false,
      badgeColor: "",
      badgeScale: 1,
      badgeStrokeWidth: 2,
    });
    expect(style?.qrCode.showOnCover).toBe(false);
  });

  it("小红书用户标识位置与大小会被安全解析", () => {
    const style = parseXhsStyle({
      themeId: "classic",
      identifier: {
        enabled: false,
        showOnCover: true,
        position: "bottom-right",
        scale: 99,
        showDate: false,
        avatarBorder: true,
      },
    });
    expect(style?.identifier).toEqual({
      enabled: false,
      showOnCover: true,
      position: "bottom-right",
      scale: 4,
      showDate: false,
      avatarBorder: true,
      badge: "wand-sparkles",
      badgeEnabled: false,
      badgeColor: "",
      badgeScale: 1,
      badgeStrokeWidth: 2,
    });
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { position: "center" } })?.identifier
        .position,
    ).toBe("top-left");
    expect(
      parseXhsStyle({
        themeId: "classic",
        identifier: { badge: "crown", badgeEnabled: true, badgeColor: "#ff2442" },
      })?.identifier,
    ).toMatchObject({ badge: "crown", badgeEnabled: true, badgeColor: "#ff2442" });
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { badge: "not-a-badge" } })?.identifier
        .badge,
    ).toBe("wand-sparkles");
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { badgeScale: 99 } })?.identifier
        .badgeScale,
    ).toBe(2);
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { badgeScale: 0.01 } })?.identifier
        .badgeScale,
    ).toBe(0.5);
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { badgeStrokeWidth: 99 } })?.identifier
        .badgeStrokeWidth,
    ).toBe(3);
    expect(
      parseXhsStyle({ themeId: "classic", identifier: { badgeStrokeWidth: 0.1 } })?.identifier
        .badgeStrokeWidth,
    ).toBe(1);
  });

  it("小红书封面和标题级别字段会被安全裁剪", () => {
    const style = parseXhsStyle({
      themeId: "classic",
      headings: { h1: { scale: 99, spacing: -2, weight: 1200, align: "diagonal" } },
      cover: {
        enabled: true,
        text: "封面",
        fontSize: 999,
        fontWeight: 100,
        lineHeight: 9,
        align: "right",
      },
    });
    expect(style?.headings.h1.scale).toBe(2.4);
    expect(style?.headings.h1.spacing).toBe(0.4);
    expect(style?.headings.h1.weight).toBe(900);
    expect(style?.headings.h1.align).toBe("left");
    expect(style?.cover.fontSize).toBe(280);
    expect(style?.cover.fontWeight).toBe(400);
    expect(style?.cover.lineHeight).toBe(1.8);
    expect(style?.cover.align).toBe("right");
  });

  it("小红书正文一级标题的自定义文字默认为空，超长会被裁剪，非字符串回落为空", () => {
    expect(DEFAULT_XHS_STYLE.bodyTitleOverride).toBe("");
    expect(parseXhsStyle({ themeId: "classic", bodyTitleOverride: "自定义标题" })?.bodyTitleOverride)
      .toBe("自定义标题");
    expect(
      parseXhsStyle({ themeId: "classic", bodyTitleOverride: "a".repeat(200) })?.bodyTitleOverride
        .length,
    ).toBe(120);
    expect(parseXhsStyle({ themeId: "classic", bodyTitleOverride: 123 })?.bodyTitleOverride).toBe("");
  });

  it("小红书标题级别的背景色 / 文字色默认为空，且非法颜色会回落为空", () => {
    expect(DEFAULT_XHS_STYLE.headings.h1.background).toBe("");
    expect(DEFAULT_XHS_STYLE.headings.h1.textColor).toBe("");
    const style = parseXhsStyle({
      themeId: "classic",
      headings: {
        h1: { background: "#ff0000", textColor: "红色" },
      },
    });
    expect(style?.headings.h1.background).toBe("#ff0000");
    expect(style?.headings.h1.textColor).toBe("");
  });

  it("小红书标题自动编号默认关闭，且字段会被安全裁剪", () => {
    expect(DEFAULT_XHS_STYLE.headings.h1.number.enabled).toBe(false);
    const style = parseXhsStyle({
      themeId: "classic",
      headings: {
        h2: {
          number: {
            enabled: true,
            sizeMultiplier: 99,
            position: "diagonal",
            color: "红色",
            opacity: 9,
            labelText: "PART",
            labelPosition: "diagonal",
            labelSizeMultiplier: 99,
            labelOpacity: 9,
          },
        },
      },
    });
    expect(style?.headings.h1.number.enabled).toBe(false);
    expect(style?.headings.h2.number).toMatchObject({
      enabled: true,
      sizeMultiplier: 5,
      position: "behind",
      color: "",
      opacity: 1,
      labelText: "PART",
      labelPosition: "right",
      labelSizeMultiplier: 1.5,
      labelOpacity: 1,
    });
  });

  it("小红书封面图形默认为空，并逐项过滤与裁剪本地数据", () => {
    const style = parseXhsStyle({
      themeId: "classic",
      cover: {
        graphics: [
          {
            id: "star-1",
            icon: "star",
            x: 999,
            y: -20,
            size: 999,
            rotation: -999,
            color: "#ff2442",
            opacity: 0,
            strokeWidth: 99,
          },
          { id: "bad", icon: "not-an-icon" },
        ],
      },
    });

    expect(style?.cover.graphics).toEqual([
      {
        id: "star-1",
        icon: "star",
        x: 100,
        y: 0,
        size: 360,
        rotation: -180,
        color: "#ff2442",
        opacity: 0.1,
        strokeWidth: 5,
      },
    ]);
  });

  it("小红书页脚序号对齐方式与大小会被安全解析", () => {
    expect(parseXhsStyle({ themeId: "classic", pageNumberAlign: "center" })?.pageNumberAlign)
      .toBe("center");
    expect(parseXhsStyle({ themeId: "classic", pageNumberAlign: "diagonal" })?.pageNumberAlign)
      .toBe("center");
    expect(parseXhsStyle({ themeId: "classic", pageNumberScale: 3.4 })?.pageNumberScale)
      .toBe(3.4);
    expect(parseXhsStyle({ themeId: "classic", pageNumberScale: 99 })?.pageNumberScale)
      .toBe(5);
    expect(parseXhsStyle({ themeId: "classic", pageNumberScale: 0 })?.pageNumberScale)
      .toBe(1);
    expect(
      parseXhsStyle({ themeId: "classic", showPageNumberOnCover: true })
        ?.showPageNumberOnCover,
    ).toBe(true);
  });

  it("小红书二维码封面开关会被安全解析", () => {
    expect(
      parseXhsStyle({
        themeId: "classic",
        qrCode: { enabled: true, showOnCover: true },
      })?.qrCode,
    ).toMatchObject({ enabled: true, showOnCover: true });
  });

  it("非法颜色回落到主题默认色", () => {
    const style = parseXhsStyle({ themeId: "classic", background: "红色" });
    expect(style?.background).toBe(getXhsTheme("classic").defaults.background);
  });

  it("公众号枚举字段非法时回落", () => {
    const style = parseWechatStyle({ themeId: "classic", headingStyle: "rainbow" });
    expect(style?.headingStyle).toBe(wechatStyleFromTheme("classic").headingStyle);
  });

  it("导出尺寸都是 3:4 的常用高清尺寸", () => {
    expect(getExportSize().id).toBe("1080");
    expect(getExportSize("1080").scale).toBe(1);
    expect(getExportSize("不存在").id).toBe("1080");
  });
});

describe("i18n", () => {
  it("中英文键完全对齐，不会某个语言缺文案", () => {
    const zhKeys = Object.entries(dictionaries.zh).flatMap(([section, group]) =>
      Object.keys(group).map((leaf) => `${section}.${leaf}`),
    );
    const enKeys = Object.entries(dictionaries.en).flatMap(([section, group]) =>
      Object.keys(group).map((leaf) => `${section}.${leaf}`),
    );
    expect(new Set(enKeys)).toEqual(new Set(zhKeys));
  });

  it("所有文案都非空", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      for (const [section, group] of Object.entries(dict)) {
        for (const [leaf, value] of Object.entries(group)) {
          expect(value, `${locale}.${section}.${leaf}`).not.toBe("");
        }
      }
    }
  });

  it("用户界面文案不暴露专业版产品名", () => {
    expect(JSON.stringify(dictionaries)).not.toMatch(/lovtype/i);
  });

  it("占位符替换", () => {
    expect(interpolate("共 {n} 页", { n: 3 })).toBe("共 3 页");
    expect(interpolate("{a} 和 {b}", { a: "x", b: "y" })).toBe("x 和 y");
  });

  it("缺少参数时保留占位符，不会渲染成 undefined", () => {
    expect(interpolate("共 {n} 页", {})).toBe("共 {n} 页");
  });

  it("translate 按语言取文案", () => {
    expect(translate("zh", "view.xhs")).toBe("小红书");
    expect(translate("en", "view.xhs")).toBe("Xiaohongshu");
  });

  it("浏览器语言推断", () => {
    expect(detectLocale(["zh-CN", "en"])).toBe("zh");
    expect(detectLocale(["en-US"])).toBe("en");
    expect(detectLocale(["fr-FR"])).toBe("zh");
    expect(detectLocale([])).toBe("zh");
  });
});
