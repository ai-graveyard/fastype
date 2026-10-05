import type { Locale, TKey } from "@/lib/i18n";
import { wechatStyleFromTheme, type WechatStyle } from "@/lib/themes/wechat";
import { xhsStyleFromTheme, type XhsStyle } from "@/lib/themes/xhs";
import type { WechatCover } from "@/lib/wechat-cover";

export const SCENES = [
  {
    id: "knowledge",
    theme: "ocean",
    title: "creator.sceneKnowledge",
    description: "creator.sceneKnowledgeDesc",
    features: "creator.sceneKnowledgeFeatures",
  },
  {
    id: "checklist",
    theme: "forest",
    title: "creator.sceneChecklist",
    description: "creator.sceneChecklistDesc",
    features: "creator.sceneChecklistFeatures",
  },
  {
    id: "essay",
    theme: "elegant",
    title: "creator.sceneEssay",
    description: "creator.sceneEssayDesc",
    features: "creator.sceneEssayFeatures",
  },
] as const satisfies readonly {
  id: string;
  theme: string;
  title: TKey;
  description: TKey;
  features: TKey;
}[];
export type SceneId = (typeof SCENES)[number]["id"];

export const SCENE_PALETTES = ["classic", "ocean", "forest", "elegant"] as const;
export type ScenePalette = (typeof SCENE_PALETTES)[number];

export function sceneXhsStyle(id: SceneId, current: XhsStyle, palette?: ScenePalette): XhsStyle {
  const scene = SCENES.find((item) => item.id === id)!;
  const base = xhsStyleFromTheme(palette ?? scene.theme, current.exportSizeId);
  return {
    ...base,
    accentColor: palette === "classic" ? base.textColor : base.accentColor,
    fontFamily: id === "essay" ? "serif" : "sans",
    fontSize: id === "knowledge" ? 38 : 36,
    lineHeight: id === "essay" ? 1.95 : id === "checklist" ? 1.5 : 1.7,
    padding: id === "essay" ? 88 : id === "checklist" ? 56 : 64,
    paragraphSpacing: id === "essay" ? 1.4 : id === "checklist" ? 0.65 : 1.1,
    headingTemplate: id === "checklist" ? "block" : id === "essay" ? "elegant" : "accent",
    elements: {
      ...base.elements,
      linkColor: palette === "classic" ? base.textColor : base.elements.linkColor,
      listSpacing: id === "checklist" ? 8 : 18,
      quoteBorderWidth: id === "essay" ? 2 : 6,
      quotePadding: id === "essay" ? 32 : 24,
    },
    headings: {
      ...base.headings,
      h2: {
        ...base.headings.h2,
        scale: id === "knowledge" ? 1.5 : 1.15,
        spacing: id === "essay" ? 2 : 1.2,
        weight: id === "essay" ? 600 : 800,
        number: {
          ...base.headings.h2.number,
          enabled: id === "checklist",
          position: "left",
          sizeMultiplier: 1.2,
          opacity: 1,
        },
      },
    },
    bodyTitleOverride: current.bodyTitleOverride,
    cover: {
      ...base.cover,
      enabled: true,
      text: current.cover.text,
      graphics: current.cover.graphics,
      hideBodyTitle: true,
      fontSize: id === "essay" ? 100 : id === "checklist" ? 144 : 128,
      fontWeight: id === "essay" ? 600 : 800,
      align: id === "essay" ? "center" : "left",
      background: base.background,
      textColor: base.textColor,
    },
    identifier: { ...current.identifier, position: "top-left", showOnCover: true },
    qrCode: current.qrCode,
    showPageNumber: true,
    showPageNumberOnCover: false,
  };
}

export function sceneWechatStyle(
  id: SceneId,
  current: WechatStyle,
  locale: Locale,
  palette?: ScenePalette,
): WechatStyle {
  const scene = SCENES.find((item) => item.id === id)!;
  const base = wechatStyleFromTheme(palette ?? scene.theme, locale);
  return {
    ...base,
    accentColor: palette === "classic" ? base.textColor : base.accentColor,
    fontFamily: id === "essay" ? "serif" : "sans",
    fontSize: id === "essay" ? 17 : id === "checklist" ? 15 : 16,
    lineHeight: id === "essay" ? 2 : id === "checklist" ? 1.65 : 1.8,
    paragraphSpacing: id === "essay" ? 24 : id === "checklist" ? 12 : 20,
    pagePadding: id === "essay" ? 28 : id === "checklist" ? 16 : 22,
    listSpacing: id === "checklist" ? 4 : 8,
    quoteStyle: id === "essay" ? "bar" : "card",
    headingTemplate: id === "checklist" ? "block" : id === "essay" ? "elegant" : "accent",
    headings: {
      ...base.headings,
      h2: {
        ...base.headings.h2,
        scale: id === "knowledge" ? 1.3 : 1.1,
        spacing: id === "essay" ? 1.8 : 1,
        weight: id === "essay" ? 600 : 800,
        number: {
          ...base.headings.h2.number,
          enabled: id === "checklist",
          position: "left",
          sizeMultiplier: 1.2,
          opacity: 1,
        },
      },
    },
    showPhoneFrame: current.showPhoneFrame,
    identityCard: current.identityCard,
    tailGuide: current.tailGuide,
  };
}

export function sceneWechatCover(
  id: SceneId,
  current: WechatCover,
  style: WechatStyle,
): WechatCover {
  return {
    ...current,
    useDocumentTitle: current.title ? current.useDocumentTitle : true,
    backgroundColor: style.pageBackground,
    textColor: style.textColor,
    overlayOpacity: 0,
    align: id === "essay" ? "center" : "left",
    position: "center",
  };
}
