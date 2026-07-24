"use client";

import {
  BadgeCheck,
  BookImage,
  FileText,
  Image as ImageIcon,
  Palette,
  QrCode,
  RotateCcw,
  Type,
} from "lucide-react";
import * as React from "react";

import {
  MarkdownEditor,
  type EditorApi,
  type EditorSelectionInfo,
} from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import {
  XHS_IDENTIFIER_BADGE_ICONS,
  XHS_IDENTIFIER_BADGE_GROUPS,
  type XhsIdentifierBadge,
} from "@/components/ui/identifier-badges";
import {
  ChoiceGrid,
  ColorField,
  Field,
  Separator,
  SliderField,
  Switch,
} from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { EditorPane } from "@/components/workbench/editor-pane";
import { PlatformModeSwitcher } from "@/components/workbench/platform-mode-switcher";
import { ProfileCard } from "@/components/workbench/profile-button";
import {
  SettingExample,
  XhsSettingExample,
} from "@/components/workbench/setting-example";
import { SettingsOutline } from "@/components/workbench/settings-outline";
import { XhsContentEditor } from "@/components/workbench/xhs-content-editor";
import {
  CoverGraphicsControls,
  CoverGraphicsEditor,
  CoverGraphicsLayer,
} from "@/components/workbench/xhs-cover-graphics";
import {
  XHS_IDENTIFIER_CONTENT_GAP,
  XhsIdentifier,
} from "@/components/workbench/xhs-identifier";
import {
  AlignPicker,
  FontPicker,
  HeadingLevelEditor,
  HeadingTemplatePicker,
  ThemePicker,
} from "@/components/workbench/style-drawers";
import {
  DEFAULT_XHS_HEADINGS,
  DEFAULT_XHS_QR_CODE,
  XHS_ASPECT_RATIOS,
  XHS_IDENTIFIER_BADGE_SCALE_RANGE,
  XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE,
  XHS_PAGE_NUMBER_SCALE_RANGE,
  XHS_THEMES,
  getXhsCanvasSize,
  getXhsTheme,
  type XhsIdentifierPosition,
} from "@/lib/themes/xhs";
import { extractTitleFromSource } from "@/lib/markdown/parse";
import type { XhsMetadata } from "@/lib/markdown/xhs-frontmatter";
import type { TKey } from "@/lib/i18n";
import type { PlatformEditorMode } from "@/lib/types";
import { cn, scrollToSection } from "@/lib/utils";
import { PLATFORM_INPUT_LIMITS } from "@/lib/constants";
import { useElementWidth } from "@/hooks/use-media-query";

export type XhsWorkspaceTab =
  "image" | "content" | "cover" | "theme" | "typography" | "enhance";

interface XhsWorkspaceProps {
  activeTab: XhsWorkspaceTab;
  onActiveTabChange: (tab: XhsWorkspaceTab) => void;
  contentMode: PlatformEditorMode;
  onContentModeChange: (mode: PlatformEditorMode) => void;
  editorRef: React.RefObject<EditorApi | null>;
  content: string;
  onContentChange: (value: string) => void;
  metadata: XhsMetadata;
  onMetadataChange: (patch: Partial<XhsMetadata>) => void;
  onSelectionChange: (info: EditorSelectionInfo) => void;
  resetKey: string;
  savePending: boolean;
  scrollTarget?: { id: string; nonce: number } | null;
  onEditProfile?: () => void;
}

const TABS: Array<{
  id: XhsWorkspaceTab;
  icon: React.ComponentType<{ className?: string }>;
  key:
    | "xhs.tabImage"
    | "xhs.tabContent"
    | "xhs.tabCover"
    | "xhs.tabTheme"
    | "xhs.tabTypography"
    | "xhs.tabPersona";
}> = [
  { id: "image", icon: BookImage, key: "xhs.tabImage" },
  { id: "content", icon: FileText, key: "xhs.tabContent" },
  { id: "cover", icon: ImageIcon, key: "xhs.tabCover" },
  { id: "theme", icon: Palette, key: "xhs.tabTheme" },
  { id: "typography", icon: Type, key: "xhs.tabTypography" },
  { id: "enhance", icon: BadgeCheck, key: "xhs.tabPersona" },
];

/** 排版 Tab 下的卡片锚点，供 SettingsOutline 生成目录；渲染顺序需要和下面的 JSX 保持一致。 */
const TYPOGRAPHY_SECTIONS: Array<{ id: string; key: TKey }> = [
  { id: "xhs-heading-design", key: "xhs.headingDesign" },
  { id: "xhs-body-typography", key: "xhs.bodyTypography" },
  { id: "xhs-text-elements", key: "xhs.textElements" },
  { id: "xhs-list-elements", key: "xhs.listElements" },
  { id: "xhs-quote-elements", key: "xhs.quoteElements" },
  { id: "xhs-code-elements", key: "xhs.codeElements" },
];

/** 目录常驻在排版 Tab 左侧；设置区总宽度低于这个值放不下「目录 + 内容」两栏，就先隐藏目录让内容独占空间。 */
const TYPOGRAPHY_OUTLINE_MIN_WIDTH = 880;

const CANVAS_PREVIEW_MAX_WIDTH = 320;
const CANVAS_PREVIEW_MAX_HEIGHT = 192;

function canvasPreviewWidth(width: number, height: number): number {
  return Math.round(
    Math.min(
      CANVAS_PREVIEW_MAX_WIDTH,
      CANVAS_PREVIEW_MAX_HEIGHT * (width / height),
    ),
  );
}

/**
 * 封面示例预览同样挤在两栏布局的左半边；大字封面多是竖版画布，通用画布预览的高度上限会把它压得很窄。
 * 这里只按高度换算一个“期望宽度”，实际渲染再用 width: 100% + maxWidth 让容器宽度兜底——
 * 横版画布换算出的宽度即使超过容器，也不会把预览撑爆。
 */
const COVER_PREVIEW_MAX_HEIGHT = 300;

function coverPreviewMaxWidth(width: number, height: number): number {
  return Math.round(COVER_PREVIEW_MAX_HEIGHT * (width / height));
}

/** 标识示例预览挤在两栏布局的左半边，需要比通用画布预览更大，才能看清左右位置的差异。 */
const IDENTIFIER_PREVIEW_MAX_WIDTH = 280;
const IDENTIFIER_PREVIEW_MAX_HEIGHT = 280;

function identifierPreviewWidth(width: number, height: number): number {
  return Math.round(
    Math.min(
      IDENTIFIER_PREVIEW_MAX_WIDTH,
      IDENTIFIER_PREVIEW_MAX_HEIGHT * (width / height),
    ),
  );
}

const IDENTIFIER_POSITIONS: Array<{
  value: XhsIdentifierPosition;
  key:
    | "xhs.identifierTopLeft"
    | "xhs.identifierTopRight"
    | "xhs.identifierBottomLeft"
    | "xhs.identifierBottomRight";
}> = [
  { value: "top-left", key: "xhs.identifierTopLeft" },
  { value: "top-right", key: "xhs.identifierTopRight" },
  { value: "bottom-left", key: "xhs.identifierBottomLeft" },
  { value: "bottom-right", key: "xhs.identifierBottomRight" },
];

const BADGE_LABEL_KEYS: Record<XhsIdentifierBadge, TKey> = {
  "wand-sparkles": "xhs.identifierBadgeWand",
  "badge-check": "xhs.identifierBadgeCheck",
  crown: "xhs.identifierBadgeCrown",
  "shield-check": "xhs.identifierBadgeShield",
  "circle-check": "xhs.identifierBadgeCircleCheck",
  "circle-user-round": "xhs.identifierBadgeCircleUser",
  plus: "xhs.identifierBadgeCreator",
  award: "xhs.identifierBadgeAward",
  star: "xhs.identifierBadgeStar",
  heart: "xhs.identifierBadgeHeart",
  zap: "xhs.identifierBadgeZap",
  flame: "xhs.identifierBadgeFlame",
  diamond: "xhs.identifierBadgeDiamond",
  sparkles: "xhs.identifierBadgeSparkles",
  gem: "xhs.identifierBadgeGem",
  trophy: "xhs.identifierBadgeTrophy",
  medal: "xhs.identifierBadgeMedal",
  target: "xhs.identifierBadgeTarget",
  flag: "xhs.identifierBadgeFlag",
  leaf: "xhs.identifierBadgeLeaf",
  rocket: "xhs.identifierBadgeRocket",
  palette: "xhs.identifierBadgePalette",
  bookmark: "xhs.identifierBadgeBookmark",
  gift: "xhs.identifierBadgeGift",
  sun: "xhs.identifierBadgeSun",
  moon: "xhs.identifierBadgeMoon",
  coffee: "xhs.identifierBadgeCoffee",
  music: "xhs.identifierBadgeMusic",
  camera: "xhs.identifierBadgeCamera",
  lightbulb: "xhs.identifierBadgeLightbulb",
  "book-open": "xhs.identifierBadgeBook",
  "globe-2": "xhs.identifierBadgeGlobe",
};

const BADGE_GROUP_LABEL_KEYS: Record<string, TKey> = {
  identity: "xhs.identifierBadgeGroupIdentity",
  achievement: "xhs.identifierBadgeGroupAchievement",
  creator: "xhs.identifierBadgeGroupCreator",
  interests: "xhs.identifierBadgeGroupInterests",
};

function PositionIndicator({ position }: { position: XhsIdentifierPosition }) {
  return (
    <span className="relative h-7 w-9 shrink-0 rounded border border-current/25">
      <span
        className={cn(
          "absolute size-2 rounded-full bg-current",
          position.startsWith("top") ? "top-1" : "bottom-1",
          position.endsWith("left") ? "left-1" : "right-1",
        )}
      />
    </span>
  );
}

function SettingCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function XhsWorkspace({
  activeTab,
  onActiveTabChange,
  contentMode,
  onContentModeChange,
  editorRef,
  content,
  onContentChange,
  metadata,
  onMetadataChange,
  onSelectionChange,
  resetKey,
  savePending,
  scrollTarget,
  onEditProfile,
}: XhsWorkspaceProps) {
  const t = useT();
  const {
    xhs,
    setXhs,
    setXhsTheme,
    resetXhs,
    xhsCustomThemes,
    selectedXhsThemeId,
    isSelectedXhsThemeDirty,
    createXhsThemeDraft,
    applyXhsCustomTheme,
    saveXhsCustomTheme,
    updateXhsCustomTheme,
    copyXhsTheme,
    deleteXhsCustomTheme,
  } = useStyles();
  const { profile } = useUserProfile();
  const theme = getXhsTheme(xhs.themeId);
  const documentTitle = React.useMemo(
    () => extractTitleFromSource(content) ?? "",
    [content],
  );
  const resolvedCoverText = xhs.cover.text.trim()
    ? xhs.cover.text
    : documentTitle.slice(0, 120);
  const canvasSize = getXhsCanvasSize(xhs);
  const settingsScrollRef = React.useRef<HTMLDivElement>(null);
  const [settingsAreaRef, settingsAreaWidth] = useElementWidth<HTMLDivElement>();
  // 宽度还没测出来时默认按放得下算，避免首帧闪一下目录再消失。
  const settingsAreaNarrow =
    settingsAreaWidth > 0 && settingsAreaWidth < TYPOGRAPHY_OUTLINE_MIN_WIDTH;
  const showTypographyOutline = activeTab === "typography" && !settingsAreaNarrow;
  const [selectedCoverGraphicId, setSelectedCoverGraphicId] = React.useState<
    string | null
  >(null);

  const updateCoverGraphic = (
    id: string,
    patch: Pick<(typeof xhs.cover.graphics)[number], "x" | "y">,
  ) => {
    setXhs({
      cover: {
        ...xhs.cover,
        graphics: xhs.cover.graphics.map((graphic) =>
          graphic.id === id ? { ...graphic, ...patch } : graphic,
        ),
      },
    });
  };

  React.useEffect(() => {
    if (!scrollTarget || activeTab === "image" || activeTab === "content") return;
    const frame = requestAnimationFrame(() => {
      scrollToSection(settingsScrollRef.current, scrollTarget.id);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, scrollTarget]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onActiveTabChange(value as XhsWorkspaceTab)}
      className="flex h-full min-h-0 flex-1 flex-col gap-0 bg-card"
    >
      <div
        className="h-[53px] shrink-0 border-b border-dashed border-border bg-background/25 px-2"
        data-testid="xhs-workspace-header"
      >
        <TabsList className="grid h-full w-full grid-cols-6 rounded-none border-0 bg-transparent p-0 shadow-none">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="min-w-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 text-[11px] text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-0 data-[state=active]:border-brand-primary data-[state=active]:bg-transparent data-[state=active]:text-brand-primary data-[state=active]:shadow-none"
            >
              <tab.icon className="size-3.5 shrink-0" />
              <span className="truncate">{t(tab.key)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="image" className="mt-0 flex min-h-0 overflow-hidden">
        <EditorPane
          editorRef={editorRef}
          savePending={savePending}
          extraActions={
            <PlatformModeSwitcher
              value={contentMode}
              onChange={onContentModeChange}
            />
          }
          aiPlatform="xiaohongshu"
        >
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChange={onContentChange}
                onSelectionChange={onSelectionChange}
                placeholder={t("editor.placeholder")}
                resetKey={resetKey}
                ariaLabel={t("a11y.editorRegion")}
                mode={contentMode}
                inputLimits={PLATFORM_INPUT_LIMITS.xhs}
              />
            </div>
          </div>
        </EditorPane>
      </TabsContent>

      <TabsContent
        value="content"
        className="mt-0 min-h-0 overflow-y-auto bg-background/35 p-4"
      >
        <XhsContentEditor
          sourceBody={content}
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      </TabsContent>

      <div
        ref={settingsAreaRef}
        className={cn(
          "flex min-h-0 flex-1",
          (activeTab === "image" || activeTab === "content") && "hidden",
        )}
      >
        {showTypographyOutline ? (
          <SettingsOutline
            label={t("xhs.settingsOutline")}
            containerRef={settingsScrollRef}
            sections={TYPOGRAPHY_SECTIONS.map((section) => ({
              id: section.id,
              label: t(section.key),
            }))}
          />
        ) : null}

        <div
          ref={settingsScrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-background/35 p-4"
        >
          <TabsContent value="cover" className="mt-0">
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard
                title={t("xhs.bigTextCover")}
                description={t("xhs.bigTextCoverHint")}
                action={
                  <Switch
                    checked={xhs.cover.enabled}
                    onCheckedChange={(enabled) =>
                      setXhs({ cover: { ...xhs.cover, enabled } })
                    }
                    aria-label={t("xhs.bigTextCover")}
                  />
                }
              >
                {xhs.cover.enabled ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingExample
                        label={t("common.examplePreview")}
                        testId="xhs-cover"
                      >
                        <div
                          className="relative mx-auto flex w-full items-center overflow-hidden rounded-lg border p-[4.5%]"
                          style={{
                            maxWidth: coverPreviewMaxWidth(
                              canvasSize.width,
                              canvasSize.height,
                            ),
                            aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                            justifyContent:
                              xhs.cover.align === "left"
                                ? "flex-start"
                                : xhs.cover.align === "right"
                                  ? "flex-end"
                                  : "center",
                            background: xhs.cover.background || xhs.accentColor,
                            color: xhs.cover.textColor || xhs.background,
                            fontFamily: "var(--font-sans)",
                          }}
                        >
                          <CoverGraphicsLayer
                            graphics={xhs.cover.graphics}
                            canvasWidth={canvasSize.width}
                            mode="preview"
                            selectedId={selectedCoverGraphicId}
                            onSelect={setSelectedCoverGraphicId}
                            onMove={updateCoverGraphic}
                          />
                          <p
                            className="relative z-20 w-full whitespace-pre-wrap break-words [word-break:normal]"
                            style={{
                              textAlign: xhs.cover.align,
                              fontSize: Math.max(18, xhs.cover.fontSize * 0.15),
                              fontWeight: xhs.cover.fontWeight,
                              lineHeight: xhs.cover.lineHeight,
                            }}
                          >
                            {resolvedCoverText || t("xhs.coverAutoTitle")}
                          </p>
                        </div>
                      </SettingExample>
                      <CoverGraphicsControls
                        graphics={xhs.cover.graphics}
                        defaultColor={xhs.cover.textColor || xhs.background}
                        selectedId={selectedCoverGraphicId}
                        onSelectedIdChange={setSelectedCoverGraphicId}
                        onChange={(graphics) =>
                          setXhs({ cover: { ...xhs.cover, graphics } })
                        }
                      />
                    </div>
                    <CoverGraphicsEditor
                      graphics={xhs.cover.graphics}
                      defaultColor={xhs.cover.textColor || xhs.background}
                      selectedId={selectedCoverGraphicId}
                      onSelectedIdChange={setSelectedCoverGraphicId}
                      onChange={(graphics) =>
                        setXhs({ cover: { ...xhs.cover, graphics } })
                      }
                    />
                    <Field label={t("xhs.coverText")} hint={t("xhs.coverTextHint")}>
                      <textarea
                        value={resolvedCoverText}
                        maxLength={120}
                        rows={3}
                        onChange={(event) =>
                          setXhs({
                            cover: { ...xhs.cover, text: event.target.value },
                          })
                        }
                        className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AlignPicker
                        label={t("xhs.coverAlign")}
                        value={xhs.cover.align}
                        onChange={(align) =>
                          setXhs({ cover: { ...xhs.cover, align } })
                        }
                      />
                      <SliderField
                        label={t("xhs.coverLineHeight")}
                        value={xhs.cover.lineHeight}
                        min={1}
                        max={1.8}
                        step={0.05}
                        onChange={(lineHeight) =>
                          setXhs({ cover: { ...xhs.cover, lineHeight } })
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SliderField
                        label={t("xhs.coverFontSize")}
                        value={xhs.cover.fontSize}
                        min={48}
                        max={280}
                        step={4}
                        suffix="px"
                        onChange={(fontSize) =>
                          setXhs({ cover: { ...xhs.cover, fontSize } })
                        }
                      />
                      <SliderField
                        label={t("xhs.coverFontWeight")}
                        value={xhs.cover.fontWeight}
                        min={400}
                        max={900}
                        step={100}
                        onChange={(fontWeight) =>
                          setXhs({ cover: { ...xhs.cover, fontWeight } })
                        }
                      />
                      <ColorField
                        label={t("xhs.coverBackground")}
                        value={xhs.cover.background || xhs.accentColor}
                        themeColor={xhs.accentColor}
                        onChange={(background) =>
                          setXhs({ cover: { ...xhs.cover, background } })
                        }
                      />
                      <ColorField
                        label={t("xhs.coverTextColor")}
                        value={xhs.cover.textColor || xhs.background}
                        themeColor={xhs.background}
                        onChange={(textColor) =>
                          setXhs({ cover: { ...xhs.cover, textColor } })
                        }
                      />
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.hideBodyTitle")}</span>
                      <Switch
                        checked={xhs.cover.hideBodyTitle}
                        onCheckedChange={(hideBodyTitle) =>
                          setXhs({ cover: { ...xhs.cover, hideBodyTitle } })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </SettingCard>
            </div>
          </TabsContent>
  
          <TabsContent value="theme" className="mt-0">
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard title={t("xhs.theme")}>
                <ThemePicker
                  themes={XHS_THEMES}
                  value={selectedXhsThemeId}
                  onChange={setXhsTheme}
                  label={t("xhs.theme")}
                  variant="xhs"
                  showLabel={false}
                  customThemes={xhsCustomThemes}
                  onCreateCustomTheme={createXhsThemeDraft}
                  onApplyCustomTheme={applyXhsCustomTheme}
                  onSaveCustomTheme={saveXhsCustomTheme}
                  onUpdateCustomTheme={updateXhsCustomTheme}
                  onCopyTheme={copyXhsTheme}
                  onDeleteCustomTheme={deleteXhsCustomTheme}
                  isSelectedCustomThemeDirty={isSelectedXhsThemeDirty}
                />
              </SettingCard>
              <SettingCard id="xhs-page-layout" title={t("xhs.pageLayout")}>
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-page-layout"
                  showPaddingGuide
                >
                  <div className="ft-xhs-body">
                    <h2>{t("common.exampleHeading2")}</h2>
                    <p>{t("common.exampleParagraph1")}</p>
                  </div>
                </XhsSettingExample>
                <SliderField
                  label={t("xhs.pagePadding")}
                  value={xhs.padding}
                  min={32}
                  max={160}
                  suffix="px"
                  onChange={(padding) => setXhs({ padding })}
                />
              </SettingCard>
              <SettingCard title={t("xhs.themeColors")}>
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-theme-colors"
                >
                  <div className="ft-xhs-body">
                    <h2>{t("common.exampleHeading2")}</h2>
                    <p>{t("common.exampleParagraph1")}</p>
                  </div>
                </XhsSettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label={t("xhs.background")}
                    value={xhs.background}
                    themeColor={theme.defaults.background}
                    onChange={(background) => setXhs({ background })}
                  />
                  <ColorField
                    label={t("xhs.textColor")}
                    value={xhs.textColor}
                    themeColor={theme.defaults.textColor}
                    onChange={(textColor) => setXhs({ textColor })}
                  />
                  <ColorField
                    label={t("xhs.accentColor")}
                    value={xhs.accentColor}
                    themeColor={theme.defaults.accentColor}
                    onChange={(accentColor) => setXhs({ accentColor })}
                  />
                </div>
                <Separator />
                <Button variant="outline" className="w-full" onClick={resetXhs}>
                  <RotateCcw />
                  {t("xhs.resetTheme")}
                </Button>
              </SettingCard>
              <SettingCard
                id="xhs-canvas-settings"
                title={t("xhs.canvasLayout")}
                description={t("xhs.canvasLayoutDesc")}
              >
                <SettingExample
                  label={t("common.examplePreview")}
                  testId="xhs-canvas"
                >
                  <div className="flex min-h-40 items-center justify-center rounded-lg bg-background/90 p-3">
                    <div
                      className="relative max-h-52 w-auto max-w-full overflow-hidden rounded-md border shadow-sm"
                      data-testid="xhs-canvas-preview"
                      style={{
                        aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                        width: `${canvasPreviewWidth(canvasSize.width, canvasSize.height)}px`,
                        height: "auto",
                        background: xhs.background,
                        borderColor: xhs.accentColor,
                      }}
                    >
                      <div
                        className="absolute inset-0 flex flex-col justify-center gap-2"
                        style={{
                          padding: `${Math.max(8, xhs.padding * 0.12)}px`,
                        }}
                      >
                        <span
                          className="h-3 w-3/5 rounded-full"
                          style={{ background: xhs.accentColor, opacity: 0.45 }}
                        />
                        <span
                          className="h-2 w-full rounded-full"
                          style={{ background: xhs.textColor, opacity: 0.14 }}
                        />
                        <span
                          className="h-2 w-5/6 rounded-full"
                          style={{ background: xhs.textColor, opacity: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                </SettingExample>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {XHS_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      type="button"
                      onClick={() => setXhs({ aspectRatio: ratio.value })}
                      className={cn(
                        "rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors",
                        xhs.aspectRatio === ratio.value
                          ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {ratio.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setXhs({ aspectRatio: "custom" })}
                    className={cn(
                      "rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors",
                      xhs.aspectRatio === "custom"
                        ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t("xhs.canvasCustom")}
                  </button>
                </div>
                {xhs.aspectRatio === "custom" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("xhs.canvasWidth")}>
                      <input
                        type="number"
                        min={720}
                        max={2160}
                        value={xhs.customWidth}
                        onChange={(event) =>
                          setXhs({ customWidth: Number(event.target.value) })
                        }
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      />
                    </Field>
                    <Field label={t("xhs.canvasHeight")}>
                      <input
                        type="number"
                        min={720}
                        max={2160}
                        value={xhs.customHeight}
                        onChange={(event) =>
                          setXhs({ customHeight: Number(event.target.value) })
                        }
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      />
                    </Field>
                  </div>
                ) : null}
              </SettingCard>
            </div>
          </TabsContent>
  
          <TabsContent value="typography" className="mt-0">
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard id="xhs-heading-design" title={t("xhs.headingDesign")}>
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-headings"
                >
                  <div className="ft-xhs-body">
                    <h1>{t("common.exampleHeading1")}</h1>
                    <h2>{t("common.exampleHeading2")}</h2>
                    <h3>{t("common.exampleHeading3")}</h3>
                  </div>
                </XhsSettingExample>
                <HeadingTemplatePicker
                  value={xhs.headingTemplate}
                  onChange={(headingTemplate) => setXhs({ headingTemplate })}
                />
                <Separator />
                <div className="grid gap-4">
                  {(["h1", "h2", "h3"] as const).map((level) => (
                    <HeadingLevelEditor
                      key={level}
                      level={level}
                      value={xhs.headings[level]}
                      accentColor={xhs.accentColor}
                      textColor={xhs.textColor}
                      onChange={(patch) =>
                        setXhs({
                          headings: {
                            ...xhs.headings,
                            [level]: { ...xhs.headings[level], ...patch },
                          },
                        })
                      }
                      onReset={() =>
                        setXhs({
                          headings: { ...xhs.headings, [level]: DEFAULT_XHS_HEADINGS[level] },
                        })
                      }
                      titleOverride={level === "h1" ? xhs.bodyTitleOverride : undefined}
                      onTitleOverrideChange={
                        level === "h1"
                          ? (bodyTitleOverride) => setXhs({ bodyTitleOverride })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </SettingCard>
              <SettingCard
                id="xhs-body-typography"
                title={t("xhs.bodyTypography")}
                description={t("xhs.bodyTypographyDesc")}
              >
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-body-typography"
                >
                  <div className="ft-xhs-body">
                    <p>{t("common.exampleParagraph1")}</p>
                    <p>{t("common.exampleParagraph2")}</p>
                  </div>
                </XhsSettingExample>
                <FontPicker
                  value={xhs.fontFamily}
                  onChange={(fontFamily) => setXhs({ fontFamily })}
                />
                <div className="space-y-3">
                  <SliderField
                    forceRow
                    label={t("xhs.fontSize")}
                    value={xhs.fontSize}
                    min={24}
                    max={60}
                    suffix="px"
                    presets={[24, 32, 40, 48]}
                    onChange={(fontSize) => setXhs({ fontSize })}
                  />
                  <SliderField
                    forceRow
                    label={t("xhs.fontWeight")}
                    value={xhs.fontWeight}
                    min={200}
                    max={800}
                    step={100}
                    presets={[300, 400, 500, 700]}
                    onChange={(fontWeight) => setXhs({ fontWeight })}
                  />
                  <SliderField
                    forceRow
                    label={t("xhs.letterSpacing")}
                    value={xhs.letterSpacing}
                    min={0}
                    max={8}
                    step={0.5}
                    suffix="px"
                    presets={[0, 2, 4, 6]}
                    onChange={(letterSpacing) => setXhs({ letterSpacing })}
                  />
                  <SliderField
                    forceRow
                    label={t("xhs.lineHeight")}
                    value={xhs.lineHeight}
                    min={1.3}
                    max={2.6}
                    step={0.05}
                    presets={[1.3, 1.7, 2.1, 2.5]}
                    presetFormat={(value) => `${value}×`}
                    onChange={(lineHeight) => setXhs({ lineHeight })}
                  />
                  <SliderField
                    forceRow
                    label={t("xhs.paragraphSpacing")}
                    value={xhs.paragraphSpacing}
                    min={0.3}
                    max={1.6}
                    step={0.05}
                    onChange={(paragraphSpacing) => setXhs({ paragraphSpacing })}
                  />
                </div>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <span>{t("xhs.textIndent")}</span>
                  <Switch
                    checked={xhs.textIndent}
                    onCheckedChange={(textIndent) => setXhs({ textIndent })}
                  />
                </label>
              </SettingCard>
              <SettingCard
                id="xhs-text-elements"
                title={t("xhs.textElements")}
                description={t("xhs.textElementsDesc")}
              >
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-text-elements"
                >
                  <div className="ft-xhs-body">
                    <p>
                      {t("common.exampleParagraph1")}{" "}
                      <strong>{t("common.exampleBold")}</strong>、{" "}
                      <em>{t("common.exampleItalic")}</em>、{" "}
                      <del>{t("common.exampleStrike")}</del>、{" "}
                      <a
                        href="#xhs-example-link"
                        onClick={(event) => event.preventDefault()}
                      >
                        {t("common.exampleLink")}
                      </a>
                    </p>
                  </div>
                </XhsSettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label={t("xhs.strongColor")}
                    value={xhs.elements.strongColor}
                    themeColor={theme.derived.strongColor}
                    onChange={(strongColor) =>
                      setXhs({ elements: { ...xhs.elements, strongColor } })
                    }
                  />
                  <ColorField
                    label={t("xhs.strongHighlight")}
                    value={xhs.elements.strongHighlight}
                    onChange={(strongHighlight) =>
                      setXhs({ elements: { ...xhs.elements, strongHighlight } })
                    }
                  />
                  <ColorField
                    label={t("xhs.italicColor")}
                    value={xhs.elements.italicColor}
                    themeColor={theme.derived.italicColor}
                    onChange={(italicColor) =>
                      setXhs({ elements: { ...xhs.elements, italicColor } })
                    }
                  />
                  <ColorField
                    label={t("xhs.strikeColor")}
                    value={xhs.elements.strikeColor}
                    themeColor={theme.derived.mutedColor}
                    onChange={(strikeColor) =>
                      setXhs({ elements: { ...xhs.elements, strikeColor } })
                    }
                  />
                  <ColorField
                    label={t("xhs.linkColor")}
                    value={xhs.elements.linkColor}
                    themeColor={theme.derived.linkColor}
                    onChange={(linkColor) =>
                      setXhs({ elements: { ...xhs.elements, linkColor } })
                    }
                  />
                </div>
                <Field label={t("xhs.linkUnderline")}>
                  <div className="grid grid-cols-3 gap-2">
                    {(["solid", "dashed", "none"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setXhs({
                            elements: { ...xhs.elements, linkUnderline: value },
                          })
                        }
                        className={cn(
                          "rounded-lg border-2 py-2 text-xs font-medium",
                          xhs.elements.linkUnderline === value
                            ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {t(
                          `xhs.linkUnderline${value[0].toUpperCase()}${value.slice(1)}` as "xhs.linkUnderlineSolid",
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
              </SettingCard>
  
              <SettingCard
                id="xhs-list-elements"
                title={t("xhs.listElements")}
                description={t("xhs.listElementsDesc")}
              >
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-lists"
                >
                  <div className="ft-xhs-body grid grid-cols-2 gap-4">
                    <ul>
                      <li>{t("common.exampleListItem1")}</li>
                      <li>{t("common.exampleListItem2")}</li>
                    </ul>
                    <ol>
                      <li>{t("common.exampleListItem1")}</li>
                      <li>{t("common.exampleListItem2")}</li>
                    </ol>
                  </div>
                </XhsSettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChoiceGrid
                    label={t("xhs.unorderedListStyle")}
                    value={xhs.elements.unorderedListStyle}
                    columns={3}
                    options={[
                      { value: "disc", label: t("xhs.listStyleDisc") },
                      { value: "circle", label: t("xhs.listStyleCircle") },
                      { value: "square", label: t("xhs.listStyleSquare") },
                    ]}
                    onChange={(unorderedListStyle) =>
                      setXhs({
                        elements: {
                          ...xhs.elements,
                          unorderedListStyle,
                        },
                      })
                    }
                  />
                  <ChoiceGrid
                    label={t("xhs.orderedListStyle")}
                    value={xhs.elements.orderedListStyle}
                    columns={3}
                    options={[
                      { value: "decimal", label: "1, 2, 3" },
                      { value: "lower-alpha", label: "a, b, c" },
                      { value: "lower-roman", label: "i, ii, iii" },
                      { value: "cjk-ideographic", label: "一, 二, 三" },
                    ]}
                    onChange={(orderedListStyle) =>
                      setXhs({
                        elements: {
                          ...xhs.elements,
                          orderedListStyle,
                        },
                      })
                    }
                  />
                  <SliderField
                    label={t("xhs.listIndent")}
                    value={xhs.elements.listIndent}
                    min={16}
                    max={80}
                    step={2}
                    suffix="px"
                    onChange={(listIndent) =>
                      setXhs({ elements: { ...xhs.elements, listIndent } })
                    }
                  />
                  <SliderField
                    label={t("xhs.listSpacing")}
                    value={xhs.elements.listSpacing}
                    min={0}
                    max={32}
                    step={1}
                    suffix="px"
                    onChange={(listSpacing) =>
                      setXhs({ elements: { ...xhs.elements, listSpacing } })
                    }
                  />
                </div>
              </SettingCard>
  
              <SettingCard id="xhs-quote-elements" title={t("xhs.quoteElements")}>
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-quote"
                >
                  <div className="ft-xhs-body">
                    <blockquote>{t("common.exampleQuote")}</blockquote>
                  </div>
                </XhsSettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label={t("xhs.quoteBackground")}
                    value={xhs.elements.quoteBackground}
                    themeColor={theme.derived.surface}
                    onChange={(quoteBackground) =>
                      setXhs({ elements: { ...xhs.elements, quoteBackground } })
                    }
                  />
                  <ColorField
                    label={t("xhs.quoteBorderColor")}
                    value={xhs.elements.quoteBorderColor}
                    themeColor={theme.derived.quoteBorderColor}
                    onChange={(quoteBorderColor) =>
                      setXhs({ elements: { ...xhs.elements, quoteBorderColor } })
                    }
                  />
                  <SliderField
                    label={t("xhs.quoteBorderWidth")}
                    value={xhs.elements.quoteBorderWidth}
                    min={0}
                    max={16}
                    suffix="px"
                    onChange={(quoteBorderWidth) =>
                      setXhs({ elements: { ...xhs.elements, quoteBorderWidth } })
                    }
                  />
                  <SliderField
                    label={t("xhs.quoteRadius")}
                    value={xhs.elements.quoteRadius}
                    min={0}
                    max={32}
                    step={2}
                    suffix="px"
                    onChange={(quoteRadius) =>
                      setXhs({ elements: { ...xhs.elements, quoteRadius } })
                    }
                  />
                  <SliderField
                    label={t("xhs.quotePadding")}
                    value={xhs.elements.quotePadding}
                    min={8}
                    max={48}
                    step={2}
                    suffix="px"
                    onChange={(quotePadding) =>
                      setXhs({ elements: { ...xhs.elements, quotePadding } })
                    }
                  />
                </div>
              </SettingCard>
  
              <SettingCard id="xhs-code-elements" title={t("xhs.codeElements")}>
                <XhsSettingExample
                  label={t("common.examplePreview")}
                  style={xhs}
                  testId="xhs-code"
                >
                  <div className="ft-xhs-body">
                    <p>
                      {t("common.exampleParagraph1")}{" "}
                      <code>{t("common.exampleInlineCode")}</code>
                    </p>
                    <pre>
                      <code>{'const publish = () => "FasType";'}</code>
                    </pre>
                  </div>
                </XhsSettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label={t("xhs.codeBackground")}
                    value={xhs.elements.codeBackground}
                    themeColor={theme.derived.codeBackground}
                    onChange={(codeBackground) =>
                      setXhs({ elements: { ...xhs.elements, codeBackground } })
                    }
                  />
                  <ColorField
                    label={t("xhs.codeColor")}
                    value={xhs.elements.codeColor}
                    themeColor={theme.derived.codeColor}
                    onChange={(codeColor) =>
                      setXhs({ elements: { ...xhs.elements, codeColor } })
                    }
                  />
                  <ColorField
                    label={t("xhs.inlineCodeBackground")}
                    value={xhs.elements.inlineCodeBackground}
                    themeColor={theme.derived.inlineCodeBackground}
                    onChange={(inlineCodeBackground) =>
                      setXhs({
                        elements: { ...xhs.elements, inlineCodeBackground },
                      })
                    }
                  />
                  <ColorField
                    label={t("xhs.inlineCodeColor")}
                    value={xhs.elements.inlineCodeColor}
                    themeColor={theme.derived.inlineCodeColor}
                    onChange={(inlineCodeColor) =>
                      setXhs({ elements: { ...xhs.elements, inlineCodeColor } })
                    }
                  />
                  <SliderField
                    label={t("xhs.codeFontSize")}
                    value={xhs.elements.codeFontSize}
                    min={18}
                    max={42}
                    suffix="px"
                    onChange={(codeFontSize) =>
                      setXhs({ elements: { ...xhs.elements, codeFontSize } })
                    }
                  />
                  <SliderField
                    label={t("xhs.codeRadius")}
                    value={xhs.elements.codeRadius}
                    min={0}
                    max={32}
                    step={2}
                    suffix="px"
                    onChange={(codeRadius) =>
                      setXhs({ elements: { ...xhs.elements, codeRadius } })
                    }
                  />
                </div>
              </SettingCard>
            </div>
          </TabsContent>
  
          <TabsContent value="enhance" className="mt-0">
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard
                title={t("xhs.identifierTitle")}
                description={t("xhs.identifierDescription")}
                action={
                  <Switch
                    checked={xhs.identifier.enabled}
                    onCheckedChange={(enabled) =>
                      setXhs({ identifier: { ...xhs.identifier, enabled } })
                    }
                    aria-label={t("xhs.identifierEnabled")}
                  />
                }
              >
                {xhs.identifier.enabled ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingExample
                        label={t("common.examplePreview")}
                        testId="xhs-identifier"
                      >
                        <div className="flex min-h-40 items-center justify-center rounded-lg bg-background/90 p-3">
                          <div
                            className="flex w-auto max-w-full flex-col overflow-hidden rounded-lg border p-4"
                            style={{
                              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                              width: `${identifierPreviewWidth(canvasSize.width, canvasSize.height)}px`,
                              maxHeight: `${IDENTIFIER_PREVIEW_MAX_HEIGHT}px`,
                              height: "auto",
                              background: xhs.background,
                            }}
                          >
                            {xhs.identifier.position.startsWith("top") ? (
                              <XhsIdentifier
                                identifier={xhs.identifier}
                                profile={profile}
                                color={xhs.textColor}
                                accentColor={xhs.accentColor}
                                unitScale={0.3}
                                style={{
                                  marginBottom:
                                    XHS_IDENTIFIER_CONTENT_GAP *
                                    xhs.identifier.scale *
                                    0.3,
                                }}
                              />
                            ) : null}
                            <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
                              <span
                                className="h-3 w-3/5 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.17 }}
                              />
                              <span
                                className="h-2.5 w-full rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                              <span
                                className="h-2.5 w-5/6 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                            </div>
                            {xhs.identifier.position.startsWith("bottom") ? (
                              <XhsIdentifier
                                identifier={xhs.identifier}
                                profile={profile}
                                color={xhs.textColor}
                                accentColor={xhs.accentColor}
                                unitScale={0.3}
                                style={{
                                  marginTop:
                                    XHS_IDENTIFIER_CONTENT_GAP *
                                    xhs.identifier.scale *
                                    0.3,
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      </SettingExample>
  
                      <div className="space-y-4">
                        <ProfileCard
                          onClick={onEditProfile}
                          hint={t("xhs.identifierEditHint")}
                        />
  
                        <Field label={t("xhs.identifierPosition")}>
                          <div className="grid grid-cols-2 gap-2">
                            {IDENTIFIER_POSITIONS.map((position) => (
                              <button
                                key={position.value}
                                type="button"
                                onClick={() =>
                                  setXhs({
                                    identifier: {
                                      ...xhs.identifier,
                                      position: position.value,
                                    },
                                  })
                                }
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border-2 p-2 text-xs font-medium transition-colors",
                                  xhs.identifier.position === position.value
                                    ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                                    : "border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <PositionIndicator position={position.value} />
                                <span>{t(position.key)}</span>
                              </button>
                            ))}
                          </div>
                        </Field>
  
                        <SliderField
                          label={t("xhs.identifierSize")}
                          value={xhs.identifier.scale}
                          min={0.5}
                          max={4}
                          step={0.1}
                          suffix="×"
                          presets={[1, 1.5, 2, 3]}
                          onChange={(scale) =>
                            setXhs({ identifier: { ...xhs.identifier, scale } })
                          }
                        />
                      </div>
                    </div>
  
                    <TooltipProvider delayDuration={200}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">
                            {t("xhs.identifierBadge")}
                          </span>
                          <Switch
                            checked={xhs.identifier.badgeEnabled}
                            onCheckedChange={(badgeEnabled) =>
                              setXhs({
                                identifier: { ...xhs.identifier, badgeEnabled },
                              })
                            }
                            aria-label={t("xhs.identifierBadgeEnabled")}
                          />
                        </div>
                        <div
                          className={cn(
                            "space-y-3 transition-opacity",
                            !xhs.identifier.badgeEnabled && "opacity-50",
                          )}
                        >
                          {XHS_IDENTIFIER_BADGE_GROUPS.map((group) => (
                            <div key={group.id} className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">
                                {t(BADGE_GROUP_LABEL_KEYS[group.id])}
                              </p>
                              <div className="grid grid-cols-8 gap-1.5">
                                {group.badges.map((badge) => {
                                  const Icon = XHS_IDENTIFIER_BADGE_ICONS[badge];
                                  const selected = xhs.identifier.badge === badge;
                                  const label = t(BADGE_LABEL_KEYS[badge]);
                                  return (
                                    <Tooltip key={badge} label={label}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setXhs({
                                            identifier: {
                                              ...xhs.identifier,
                                              badge,
                                            },
                                          })
                                        }
                                        aria-label={label}
                                        aria-pressed={selected}
                                        className={cn(
                                          "flex aspect-square items-center justify-center rounded-lg border-2 p-1.5 transition-colors",
                                          selected
                                            ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                                            : "border-border text-muted-foreground hover:text-foreground",
                                        )}
                                      >
                                        <Icon className="size-4" />
                                      </button>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
  
                      <div
                        className={cn(
                          "grid gap-4 transition-opacity sm:grid-cols-2",
                          !xhs.identifier.badgeEnabled && "opacity-50",
                        )}
                      >
                        <ColorField
                          label={t("xhs.identifierBadgeColor")}
                          value={xhs.identifier.badgeColor || xhs.accentColor}
                          themeColor={xhs.accentColor}
                          onChange={(badgeColor) =>
                            setXhs({
                              identifier: { ...xhs.identifier, badgeColor },
                            })
                          }
                        />
                        <div className="space-y-4">
                          <SliderField
                            label={t("xhs.identifierBadgeSize")}
                            value={xhs.identifier.badgeScale}
                            min={XHS_IDENTIFIER_BADGE_SCALE_RANGE.min}
                            max={XHS_IDENTIFIER_BADGE_SCALE_RANGE.max}
                            step={XHS_IDENTIFIER_BADGE_SCALE_RANGE.step}
                            suffix="×"
                            presets={[0.75, 1, 1.25, 1.5]}
                            onChange={(badgeScale) =>
                              setXhs({
                                identifier: { ...xhs.identifier, badgeScale },
                              })
                            }
                          />
                          <SliderField
                            label={t("xhs.identifierBadgeStrokeWidth")}
                            value={xhs.identifier.badgeStrokeWidth}
                            min={XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.min}
                            max={XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.max}
                            step={XHS_IDENTIFIER_BADGE_STROKE_WIDTH_RANGE.step}
                            presets={[1.5, 2, 2.5, 3]}
                            onChange={(badgeStrokeWidth) =>
                              setXhs({
                                identifier: { ...xhs.identifier, badgeStrokeWidth },
                              })
                            }
                          />
                        </div>
                      </div>
                    </TooltipProvider>
  
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.identifierShowOnCover")}</span>
                      <Switch
                        checked={xhs.identifier.showOnCover}
                        onCheckedChange={(showOnCover) =>
                          setXhs({
                            identifier: { ...xhs.identifier, showOnCover },
                          })
                        }
                        aria-label={t("xhs.identifierShowOnCover")}
                      />
                    </label>
  
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.identifierShowDate")}</span>
                      <Switch
                        checked={xhs.identifier.showDate}
                        onCheckedChange={(showDate) =>
                          setXhs({ identifier: { ...xhs.identifier, showDate } })
                        }
                      />
                    </label>
  
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.identifierAvatarBorder")}</span>
                      <Switch
                        checked={xhs.identifier.avatarBorder}
                        onCheckedChange={(avatarBorder) =>
                          setXhs({
                            identifier: { ...xhs.identifier, avatarBorder },
                          })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </SettingCard>
  
              <SettingCard
                title={t("xhs.qrCode")}
                description={t("xhs.qrCodeDesc")}
                action={
                  <Switch
                    checked={xhs.qrCode.enabled}
                    onCheckedChange={(enabled) =>
                      setXhs({ qrCode: { ...xhs.qrCode, enabled } })
                    }
                    aria-label={t("xhs.qrCode")}
                  />
                }
              >
                {xhs.qrCode.enabled ? (
                  <>
                    <Field label={t("xhs.qrCodeUrl")} hint={t("xhs.qrCodeUrlHint")}>
                      <div className="relative">
                        <QrCode className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <input
                          type="url"
                          value={xhs.qrCode.url}
                          onChange={(event) =>
                            setXhs({
                              qrCode: { ...xhs.qrCode, url: event.target.value },
                            })
                          }
                          onBlur={(event) => {
                            if (event.target.value.trim()) return;
                            setXhs({
                              qrCode: { ...xhs.qrCode, url: DEFAULT_XHS_QR_CODE.url },
                            });
                          }}
                          placeholder={DEFAULT_XHS_QR_CODE.url}
                          className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm"
                        />
                      </div>
                    </Field>
  
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingExample
                        label={t("common.examplePreview")}
                        testId="xhs-qr-code"
                      >
                        <div className="flex min-h-40 items-center justify-center rounded-lg bg-background/90 p-3">
                          <div
                            className="relative w-auto max-w-full overflow-hidden rounded-lg border p-4"
                            style={{
                              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                              width: `${identifierPreviewWidth(canvasSize.width, canvasSize.height)}px`,
                              maxHeight: `${IDENTIFIER_PREVIEW_MAX_HEIGHT}px`,
                              height: "auto",
                              background: xhs.background,
                            }}
                          >
                            <div className="flex h-full flex-col justify-center gap-2.5">
                              <span
                                className="h-3 w-3/5 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.17 }}
                              />
                              <span
                                className="h-2.5 w-full rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                              <span
                                className="h-2.5 w-5/6 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                            </div>
                            <div
                              className={cn(
                                "absolute flex items-center gap-2",
                                xhs.qrCode.position.startsWith("top")
                                  ? "top-3"
                                  : "bottom-3",
                                xhs.qrCode.position.endsWith("left")
                                  ? "left-3"
                                  : "right-3",
                              )}
                            >
                              <span className="rounded-md bg-white p-1 shadow-sm ring-1 ring-black/10">
                                <QrCode
                                  className="text-slate-900"
                                  style={{
                                    width: 28 * xhs.qrCode.scale,
                                    height: 28 * xhs.qrCode.scale,
                                  }}
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      </SettingExample>
  
                      <div className="space-y-4">
                        <Field label={t("xhs.qrCodePosition")}>
                          <div className="grid grid-cols-2 gap-2">
                            {IDENTIFIER_POSITIONS.map((position) => (
                              <button
                                key={position.value}
                                type="button"
                                onClick={() =>
                                  setXhs({
                                    qrCode: {
                                      ...xhs.qrCode,
                                      position: position.value,
                                    },
                                  })
                                }
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border-2 p-2 text-xs font-medium transition-colors",
                                  xhs.qrCode.position === position.value
                                    ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                                    : "border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <PositionIndicator position={position.value} />
                                <span>{t(position.key)}</span>
                              </button>
                            ))}
                          </div>
                        </Field>
  
                        <SliderField
                          label={t("xhs.qrCodeSize")}
                          value={xhs.qrCode.scale}
                          min={0.5}
                          max={2}
                          step={0.05}
                          suffix="×"
                          onChange={(scale) =>
                            setXhs({ qrCode: { ...xhs.qrCode, scale } })
                          }
                        />
                      </div>
                    </div>
  
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.qrCodeShowOnCover")}</span>
                      <Switch
                        checked={xhs.qrCode.showOnCover}
                        onCheckedChange={(showOnCover) =>
                          setXhs({ qrCode: { ...xhs.qrCode, showOnCover } })
                        }
                        aria-label={t("xhs.qrCodeShowOnCover")}
                      />
                    </label>
                  </>
                ) : null}
              </SettingCard>
  
              <SettingCard
                title={t("xhs.pageNumber")}
                description={t("xhs.pageNumberDescription")}
                action={
                  <Switch
                    checked={xhs.showPageNumber}
                    onCheckedChange={(showPageNumber) =>
                      setXhs({ showPageNumber })
                    }
                    aria-label={t("xhs.pageNumber")}
                  />
                }
              >
                {xhs.showPageNumber ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingExample
                        label={t("common.examplePreview")}
                        testId="xhs-page-number"
                      >
                        <div className="flex min-h-40 items-center justify-center rounded-lg bg-background/90 p-3">
                          <div
                            className="relative w-auto max-w-full overflow-hidden rounded-lg border p-4"
                            style={{
                              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                              width: `${identifierPreviewWidth(canvasSize.width, canvasSize.height)}px`,
                              maxHeight: `${IDENTIFIER_PREVIEW_MAX_HEIGHT}px`,
                              height: "auto",
                              background: xhs.background,
                            }}
                          >
                            <div className="flex h-full flex-col justify-center gap-2.5">
                              <span
                                className="h-3 w-3/5 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.17 }}
                              />
                              <span
                                className="h-2.5 w-full rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                              <span
                                className="h-2.5 w-5/6 rounded-full"
                                style={{ background: xhs.textColor, opacity: 0.1 }}
                              />
                            </div>
                            <div
                              className={cn(
                                "absolute inset-x-4 bottom-3 flex",
                                xhs.pageNumberAlign === "left"
                                  ? "justify-start"
                                  : xhs.pageNumberAlign === "center"
                                    ? "justify-center"
                                    : "justify-end",
                              )}
                              style={{
                                color: xhs.textColor,
                                fontSize: `${Math.min(28, 7 + xhs.pageNumberScale * 4)}px`,
                                transform: `translateY(${Math.min(8, xhs.pageNumberGap * 0.4)}px)`,
                                opacity: 0.5,
                              }}
                            >
                              1 / 6
                            </div>
                          </div>
                        </div>
                      </SettingExample>
                      <div className="space-y-4">
                        <AlignPicker
                          label={t("xhs.pageNumberAlign")}
                          value={xhs.pageNumberAlign}
                          onChange={(pageNumberAlign) => setXhs({ pageNumberAlign })}
                        />
                        <SliderField
                          label={t("xhs.pageNumberSize")}
                          value={xhs.pageNumberScale}
                          min={XHS_PAGE_NUMBER_SCALE_RANGE.min}
                          max={XHS_PAGE_NUMBER_SCALE_RANGE.max}
                          step={XHS_PAGE_NUMBER_SCALE_RANGE.step}
                          suffix="×"
                          onChange={(pageNumberScale) =>
                            setXhs({ pageNumberScale })
                          }
                        />
                        <SliderField
                          label={t("xhs.pageNumberGap")}
                          value={xhs.pageNumberGap}
                          min={0}
                          max={16}
                          suffix="px"
                          onChange={(pageNumberGap) => setXhs({ pageNumberGap })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <span>{t("xhs.pageNumberShowOnCover")}</span>
                      <Switch
                        checked={xhs.showPageNumberOnCover}
                        onCheckedChange={(showPageNumberOnCover) =>
                          setXhs({ showPageNumberOnCover })
                        }
                        aria-label={t("xhs.pageNumberShowOnCover")}
                      />
                    </label>
                  </>
                ) : null}
              </SettingCard>
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
