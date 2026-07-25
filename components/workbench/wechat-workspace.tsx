"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileText,
  Image as ImageIcon,
  Palette,
  RotateCcw,
  Sparkles,
  Type,
  UserRound,
} from "lucide-react";
import * as React from "react";

import { ColorPicker } from "@/components/common/color-picker";
import { SettingCard } from "@/components/common/setting-card";
import {
  MarkdownEditor,
  type EditorApi,
  type EditorSelectionInfo,
} from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import { ChoiceGrid, Field, Label, SliderField, Switch } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorPane } from "@/components/workbench/editor-pane";
import { PlatformModeSwitcher } from "@/components/workbench/platform-mode-switcher";
import { ProfileCard } from "@/components/workbench/profile-button";
import { SettingsOutline } from "@/components/workbench/settings-outline";
import { WechatCoverEditor } from "@/components/workbench/wechat-cover-editor";
import { SettingExample, WechatSettingExample } from "@/components/workbench/setting-example";
import { ThemePicker } from "@/components/workbench/style-drawers";
import type { WechatWorkspaceTab } from "@/components/workbench/wechat-preview";
import { useElementWidth } from "@/hooks/use-media-query";
import type { TKey } from "@/lib/i18n";
import { extractLeadParagraphFromSource, extractTitleFromSource } from "@/lib/markdown/parse";
import { strongHighlightBackground } from "@/lib/render/wechat";
import type { PlatformEditorMode } from "@/lib/types";
import {
  CARD_ALIGNS,
  DEFAULT_IDENTITY_CARD,
  GUIDE_AUTHOR_ALIGNS,
  HEADING_TEMPLATES,
  STRONG_HIGHLIGHT_HEIGHTS,
  WECHAT_FONT_CHOICES,
  WECHAT_THEMES,
  createDefaultHeadingLevel,
  getWechatTheme,
  wechatFontStack,
  type CardAlign,
  type GuideAuthorAlign,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
  type HeadingTemplate,
  type IdentityCardStyle,
  type LinkUnderline,
  type QuoteStyle,
  type StrongHighlightHeight,
  type TailGuideStyle,
  type WechatFontChoice,
  type WechatHeadingLevelStyle,
} from "@/lib/themes/wechat";
import { cn, scrollToSection } from "@/lib/utils";
import { PLATFORM_INPUT_LIMITS } from "@/lib/constants";

interface WechatWorkspaceProps {
  activeTab: WechatWorkspaceTab;
  onActiveTabChange: (tab: WechatWorkspaceTab) => void;
  contentMode: PlatformEditorMode;
  onContentModeChange: (mode: PlatformEditorMode) => void;
  editorRef: React.RefObject<EditorApi | null>;
  content: string;
  onContentChange: (value: string) => void;
  onSelectionChange: (info: EditorSelectionInfo) => void;
  resetKey: string;
  savePending: boolean;
  documentTitle?: string;
  docBaseName?: string;
  scrollTarget?: { id: string; nonce: number } | null;
  onEditProfile?: () => void;
}

const TABS: Array<{
  id: WechatWorkspaceTab;
  icon: React.ComponentType<{ className?: string }>;
  key:
    | "wechat.tabContent"
    | "wechat.tabCover"
    | "wechat.tabTheme"
    | "wechat.tabTypography"
    | "wechat.tabPersona";
}> = [
  { id: "content", icon: FileText, key: "wechat.tabContent" },
  { id: "cover", icon: ImageIcon, key: "wechat.tabCover" },
  { id: "theme", icon: Palette, key: "wechat.tabTheme" },
  { id: "typography", icon: Type, key: "wechat.tabTypography" },
  { id: "enhance", icon: UserRound, key: "wechat.tabPersona" },
];

/** 排版 Tab 下的卡片锚点，供 SettingsOutline 生成目录；渲染顺序需要和下面的 JSX 保持一致。 */
const WECHAT_TYPOGRAPHY_SECTIONS: Array<{ id: string; key: TKey }> = [
  { id: "wechat-heading-system", key: "wechat.headingSystem" },
  { id: "wechat-body-typography", key: "wechat.bodyTypography" },
  { id: "wechat-text-elements", key: "wechat.textElements" },
  { id: "wechat-list-settings", key: "wechat.listSettings" },
  { id: "wechat-quote-settings", key: "wechat.quoteSettings" },
  { id: "wechat-code-settings", key: "wechat.codeSettings" },
];

/** 目录常驻在排版 Tab 左侧；设置区总宽度低于这个值放不下「目录 + 内容」两栏，就先隐藏目录让内容独占空间。 */
const WECHAT_TYPOGRAPHY_OUTLINE_MIN_WIDTH = 880;

/** action 放在卡片标题右上角，用于承载整块的启用开关，省掉单独占一行的开关。 */

function AlignPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CardAlign;
  onChange: (value: CardAlign) => void;
}) {
  const icons = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {CARD_ALIGNS.map((align) => {
          const Icon = icons[align];
          return (
            <button
              key={align}
              type="button"
              aria-label={`${label}-${align}`}
              onClick={() => onChange(align)}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border transition-colors",
                value === align
                  ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 贴在字段标签右侧的紧凑对齐切换，省掉一整格 AlignPicker 的纵向空间。 */
function InlineAlignPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CardAlign;
  onChange: (value: CardAlign) => void;
}) {
  const icons = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
      {CARD_ALIGNS.map((align) => {
        const Icon = icons[align];
        return (
          <button
            key={align}
            type="button"
            aria-label={`${label}-${align}`}
            onClick={() => onChange(align)}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm transition-colors",
              value === align
                ? "bg-background text-brand-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3" />
          </button>
        );
      })}
    </div>
  );
}

/** 身份卡片的一行设置：标签 + 行内对齐切换，控件在下方。 */
function CardField({
  label,
  align,
  onAlignChange,
  hint,
  children,
}: React.PropsWithChildren<{
  label: string;
  align?: CardAlign;
  onAlignChange?: (value: CardAlign) => void;
  hint?: string;
}>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {align && onAlignChange ? (
          <InlineAlignPicker label={label} value={align} onChange={onAlignChange} />
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CardGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function CardInput({
  label,
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm",
        readOnly && "text-muted-foreground",
      )}
    />
  );
}

function ColorControl({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      label={label}
      value={value}
      displayValue={fallback}
      placeholder={fallback}
      themeColor={fallback}
      onChange={onChange}
    />
  );
}

function TextControl({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      />
    </Field>
  );
}

function SectionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const WECHAT_HEADING_LEVELS = ["h1", "h2", "h3"] as const;
type WechatHeadingLevelKey = (typeof WECHAT_HEADING_LEVELS)[number];
const WECHAT_HEADING_LEVEL_LABEL_KEYS: Record<
  WechatHeadingLevelKey,
  "wechat.h1" | "wechat.h2" | "wechat.h3"
> = {
  h1: "wechat.h1",
  h2: "wechat.h2",
  h3: "wechat.h3",
};

function WechatHeadingLevelCard({
  level,
  value,
  accentColor,
  textColor,
  onChange,
  onReset,
}: {
  level: WechatHeadingLevelKey;
  value: WechatHeadingLevelStyle;
  accentColor: string;
  textColor: string;
  onChange: (patch: Partial<WechatHeadingLevelStyle>) => void;
  onReset?: () => void;
}) {
  const t = useT();
  const numberingId = React.useId();
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t(WECHAT_HEADING_LEVEL_LABEL_KEYS[level])}</p>
        {onReset ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onReset}
            title={t("wechat.headingReset")}
            aria-label={t("wechat.headingReset")}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
      <SliderField
        label={t("wechat.headingScale")}
        value={value.scale}
        min={0.75}
        max={1.5}
        step={0.05}
        onChange={(scale) => onChange({ scale })}
      />
      <SliderField
        label={t("wechat.headingSpacingScale")}
        value={value.spacing}
        min={0.5}
        max={2}
        step={0.1}
        onChange={(spacing) => onChange({ spacing })}
      />
      <SliderField
        label={t("wechat.headingWeight")}
        value={value.weight}
        min={400}
        max={900}
        step={100}
        onChange={(weight) => onChange({ weight })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorControl
          label={t("wechat.headingBackground")}
          value={value.background}
          fallback={accentColor}
          onChange={(background) => onChange({ background })}
        />
        <ColorControl
          label={t("wechat.headingTextColor")}
          value={value.textColor}
          fallback={textColor}
          onChange={(nextTextColor) => onChange({ textColor: nextTextColor })}
        />
      </div>
      <div className="grid grid-cols-2 items-start gap-4">
        <AlignPicker
          label={t("wechat.headingAlign")}
          value={value.align}
          onChange={(align) => onChange({ align })}
        />
        <div className="flex h-9 items-center justify-between gap-2 self-end">
          <Label htmlFor={numberingId}>{t("wechat.headingNumbering")}</Label>
          <Switch
            id={numberingId}
            aria-label={t("wechat.headingNumbering")}
            checked={value.number.enabled}
            onCheckedChange={(enabled) => onChange({ number: { ...value.number, enabled } })}
          />
        </div>
      </div>
      {value.number.enabled ? (
        <div className="space-y-4 border-t border-border/70 pt-4">
          <ChoiceGrid<HeadingNumberPosition>
            label={t("wechat.headingNumberPosition")}
            value={value.number.position}
            options={[
              { value: "behind", label: t("wechat.numberBehind") },
              { value: "top", label: t("wechat.numberTop") },
              { value: "bottom", label: t("wechat.numberBottom") },
              { value: "left", label: t("wechat.numberLeft") },
            ]}
            onChange={(position) => onChange({ number: { ...value.number, position } })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SliderField
              label={t("wechat.headingNumberSize")}
              value={value.number.sizeMultiplier}
              min={1}
              max={5}
              step={0.1}
              onChange={(sizeMultiplier) =>
                onChange({ number: { ...value.number, sizeMultiplier } })
              }
            />
            <SliderField
              label={t("wechat.headingNumberOpacity")}
              value={value.number.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(opacity) => onChange({ number: { ...value.number, opacity } })}
            />
            <ColorControl
              label={t("wechat.headingNumberColor")}
              value={value.number.color}
              fallback={accentColor}
              onChange={(color) => onChange({ number: { ...value.number, color } })}
            />
            <TextControl
              label={t("wechat.headingLabelText")}
              value={value.number.labelText}
              onChange={(labelText) => onChange({ number: { ...value.number, labelText } })}
              placeholder="PART"
            />
          </div>
          {value.number.labelText ? (
            <>
              <ChoiceGrid<HeadingNumberLabelPosition>
                label={t("wechat.headingLabelPosition")}
                value={value.number.labelPosition}
                options={[
                  { value: "right", label: t("wechat.numberRight") },
                  { value: "left", label: t("wechat.numberLeft") },
                  { value: "top", label: t("wechat.numberTop") },
                  { value: "bottom", label: t("wechat.numberBottom") },
                ]}
                onChange={(labelPosition) =>
                  onChange({ number: { ...value.number, labelPosition } })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SliderField
                  label={t("wechat.headingLabelSize")}
                  value={value.number.labelSizeMultiplier}
                  min={0.4}
                  max={1.5}
                  step={0.1}
                  onChange={(labelSizeMultiplier) =>
                    onChange({ number: { ...value.number, labelSizeMultiplier } })
                  }
                />
                <SliderField
                  label={t("wechat.headingLabelOpacity")}
                  value={value.number.labelOpacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(labelOpacity) =>
                    onChange({ number: { ...value.number, labelOpacity } })
                  }
                />
                <ColorControl
                  label={t("wechat.headingLabelColor")}
                  value={value.number.labelColor}
                  fallback={value.number.color || accentColor}
                  onChange={(labelColor) => onChange({ number: { ...value.number, labelColor } })}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function escapeExampleText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function WechatWorkspace({
  activeTab,
  onActiveTabChange,
  contentMode,
  onContentModeChange,
  editorRef,
  content,
  onContentChange,
  onSelectionChange,
  resetKey,
  savePending,
  documentTitle = "",
  docBaseName = "untitled",
  scrollTarget,
  onEditProfile,
}: WechatWorkspaceProps) {
  const t = useT();
  const { profile } = useUserProfile();
  const settingsScrollRef = React.useRef<HTMLDivElement>(null);
  const [settingsAreaRef, settingsAreaWidth] = useElementWidth<HTMLDivElement>();
  // 宽度还没测出来时默认按放得下算，避免首帧闪一下目录再消失。
  const settingsAreaNarrow =
    settingsAreaWidth > 0 && settingsAreaWidth < WECHAT_TYPOGRAPHY_OUTLINE_MIN_WIDTH;
  const showTypographyOutline = activeTab === "typography" && !settingsAreaNarrow;
  const {
    wechat,
    setWechat,
    setWechatTheme,
    resetWechat,
    wechatCustomThemes,
    selectedWechatThemeId,
    isSelectedWechatThemeDirty,
    createWechatThemeDraft,
    applyWechatCustomTheme,
    saveWechatCustomTheme,
    updateWechatCustomTheme,
    copyWechatTheme,
    deleteWechatCustomTheme,
  } = useStyles();
  const theme = getWechatTheme(wechat.themeId);
  const palette = theme.palette;
  const setIdentity = (patch: Partial<IdentityCardStyle>) =>
    setWechat({ identityCard: { ...wechat.identityCard, ...patch } });
  const setTail = (patch: Partial<TailGuideStyle>) =>
    setWechat({ tailGuide: { ...wechat.tailGuide, ...patch } });
  const contentPreviewStyle = React.useMemo(
    () => ({
      ...wechat,
      identityCard: { ...wechat.identityCard, enabled: false },
      tailGuide: { ...wechat.tailGuide, enabled: false },
    }),
    [wechat],
  );
  const identityPreviewStyle = React.useMemo(
    () => ({
      ...wechat,
      tailGuide: { ...wechat.tailGuide, enabled: false },
    }),
    [wechat],
  );
  /** 标题、副标题留空时渲染层会从正文兜底，这里把兜底值显示成占位符，让用户知道卡片上会出现什么。 */
  const derivedCard = React.useMemo(
    () => ({
      title: extractTitleFromSource(content) ?? "",
      subtitle: extractLeadParagraphFromSource(content) ?? "",
    }),
    [content],
  );
  const tailPreviewStyle = React.useMemo(
    () => ({
      ...wechat,
      identityCard: { ...wechat.identityCard, enabled: false },
    }),
    [wechat],
  );
  const example = {
    h1: escapeExampleText(t("common.exampleHeading1")),
    h2: escapeExampleText(t("common.exampleHeading2")),
    h3: escapeExampleText(t("common.exampleHeading3")),
    paragraph1: escapeExampleText(t("common.exampleParagraph1")),
    paragraph2: escapeExampleText(t("common.exampleParagraph2")),
    bold: escapeExampleText(t("common.exampleBold")),
    italic: escapeExampleText(t("common.exampleItalic")),
    strike: escapeExampleText(t("common.exampleStrike")),
    link: escapeExampleText(t("common.exampleLink")),
    quote: escapeExampleText(t("common.exampleQuote")),
    list1: escapeExampleText(t("common.exampleListItem1")),
    list2: escapeExampleText(t("common.exampleListItem2")),
    inlineCode: escapeExampleText(t("common.exampleInlineCode")),
  };

  React.useEffect(() => {
    if (!scrollTarget || activeTab === "content") return;
    requestAnimationFrame(() => {
      scrollToSection(settingsScrollRef.current, scrollTarget.id);
    });
  }, [activeTab, scrollTarget]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      <div
        className="grid h-[53px] shrink-0 grid-cols-5 border-b border-dashed border-border bg-background/25 px-2"
        data-testid="wechat-workspace-header"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onActiveTabChange(tab.id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 text-[11px] font-medium transition-colors",
              activeTab === tab.id
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5 shrink-0" />
            <span className="truncate">{t(tab.key)}</span>
          </button>
        ))}
      </div>

      <div
        className={cn("flex min-h-0 flex-1 overflow-hidden", activeTab !== "content" && "hidden")}
      >
        <EditorPane
          editorRef={editorRef}
          savePending={savePending}
          extraActions={<PlatformModeSwitcher value={contentMode} onChange={onContentModeChange} />}
          aiPlatform="wechat"
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
                inputLimits={PLATFORM_INPUT_LIMITS.wechat}
              />
            </div>
          </div>
        </EditorPane>
      </div>

      <div
        ref={settingsAreaRef}
        className={cn(
          "flex min-h-0 flex-1 overflow-hidden border-t border-dashed border-border",
          activeTab === "content" && "hidden",
        )}
      >
        {showTypographyOutline ? (
          <SettingsOutline
            label={t("wechat.settingsOutline")}
            containerRef={settingsScrollRef}
            sections={WECHAT_TYPOGRAPHY_SECTIONS.map((section) => ({
              id: section.id,
              label: t(section.key),
            }))}
          />
        ) : null}

        <div
          ref={settingsScrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-background/35 p-4"
        >
          {activeTab === "cover" ? (
            <WechatCoverEditor documentTitle={documentTitle} docBaseName={docBaseName} />
          ) : null}
          {activeTab === "theme" ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard
                title={t("wechat.themeLibrary")}
                description={t("wechat.themeLibraryDesc")}
              >
                <ThemePicker
                  themes={WECHAT_THEMES}
                  value={selectedWechatThemeId}
                  onChange={setWechatTheme}
                  label={t("wechat.theme")}
                  variant="wechat"
                  showLabel={false}
                  customThemes={wechatCustomThemes}
                  onCreateCustomTheme={createWechatThemeDraft}
                  onApplyCustomTheme={applyWechatCustomTheme}
                  onSaveCustomTheme={saveWechatCustomTheme}
                  onUpdateCustomTheme={updateWechatCustomTheme}
                  onCopyTheme={copyWechatTheme}
                  onDeleteCustomTheme={deleteWechatCustomTheme}
                  isSelectedCustomThemeDirty={isSelectedWechatThemeDirty}
                />
              </SettingCard>
              <SettingCard id="wechat-page-layout" title={t("wechat.pageLayout")}>
                <SettingExample label={t("common.examplePreview")} testId="wechat-page-layout">
                  <div className="rounded-lg border bg-background/90 p-2">
                    <div
                      className="relative overflow-hidden rounded-md border shadow-sm"
                      style={{
                        backgroundColor: wechat.pageBackground,
                        borderColor: theme.palette.pageBorderColor,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 border-r border-dashed border-brand-primary/35 bg-brand-primary/8"
                        style={{ width: Math.min(wechat.pagePadding, 64) }}
                      />
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 border-l border-dashed border-brand-primary/35 bg-brand-primary/8"
                        style={{ width: Math.min(wechat.pagePadding, 64) }}
                      />
                      <div
                        className="relative space-y-2 py-4"
                        style={{
                          paddingLeft: wechat.pagePadding,
                          paddingRight: wechat.pagePadding,
                          color: wechat.textColor,
                          fontFamily: wechatFontStack(wechat.fontFamily),
                        }}
                      >
                        <h4
                          className="text-sm font-semibold"
                          style={{ color: palette.headingColor }}
                        >
                          {t("common.exampleHeading2")}
                        </h4>
                        <p className="text-sm">{t("common.exampleParagraph1")}</p>
                      </div>
                    </div>
                  </div>
                </SettingExample>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SliderField
                    label={t("wechat.pagePadding")}
                    value={wechat.pagePadding}
                    min={0}
                    max={64}
                    suffix="px"
                    onChange={(pagePadding) => setWechat({ pagePadding })}
                  />
                  <ColorControl
                    label={t("wechat.pageBackground")}
                    value={wechat.pageBackground}
                    fallback={theme.defaults.pageBackground}
                    onChange={(pageBackground) => setWechat({ pageBackground })}
                  />
                  <ColorControl
                    label={t("wechat.textColor")}
                    value={wechat.textColor}
                    fallback={theme.defaults.textColor}
                    onChange={(textColor) => setWechat({ textColor })}
                  />
                  <ColorControl
                    label={t("wechat.accentColor")}
                    value={wechat.accentColor}
                    fallback={theme.defaults.accentColor}
                    onChange={(accentColor) => setWechat({ accentColor })}
                  />
                </div>
              </SettingCard>
              <Button variant="outline" className="w-full" onClick={resetWechat}>
                <RotateCcw />
                {t("wechat.resetTheme")}
              </Button>
            </div>
          ) : null}

          {activeTab === "typography" ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard
                id="wechat-heading-system"
                title={t("wechat.headingSystem")}
                description={t("wechat.headingSystemDesc")}
              >
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<h1>${example.h1}</h1><h2>${example.h2}</h2><h3>${example.h3}</h3>`}
                  style={contentPreviewStyle}
                  testId="wechat-headings"
                />
                <ChoiceGrid<HeadingTemplate>
                  label={t("wechat.headingTemplate")}
                  value={wechat.headingTemplate}
                  options={HEADING_TEMPLATES.map((value) => ({
                    value,
                    label: t(
                      `wechat.headingTemplate${value[0].toUpperCase()}${value.slice(1)}` as "wechat.headingTemplateClassic",
                    ),
                    sample: (
                      <span className="font-bold" style={{ color: palette.headingColor }}>
                        {value === "accent" ? "▌" : value === "underline" ? "A̲" : "Aa"}
                      </span>
                    ),
                  }))}
                  onChange={(headingTemplate) => setWechat({ headingTemplate })}
                  columns={4}
                />
                <div className="space-y-4">
                  {WECHAT_HEADING_LEVELS.map((level) => (
                    <WechatHeadingLevelCard
                      key={level}
                      level={level}
                      value={wechat.headings[level]}
                      accentColor={wechat.accentColor}
                      textColor={wechat.textColor}
                      onChange={(patch) =>
                        setWechat({
                          headings: {
                            ...wechat.headings,
                            [level]: { ...wechat.headings[level], ...patch },
                          },
                        })
                      }
                      onReset={() =>
                        setWechat({
                          headings: { ...wechat.headings, [level]: createDefaultHeadingLevel() },
                        })
                      }
                    />
                  ))}
                </div>
              </SettingCard>
              <SettingCard
                id="wechat-body-typography"
                title={t("wechat.bodyTypography")}
                description={t("wechat.bodyTypographyDesc")}
              >
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<p>${example.paragraph1}</p><p>${example.paragraph2}</p>`}
                  style={contentPreviewStyle}
                  testId="wechat-body-typography"
                />
                <ChoiceGrid<WechatFontChoice>
                  label={t("wechat.fontFamily")}
                  value={wechat.fontFamily}
                  options={WECHAT_FONT_CHOICES.map((font) => ({
                    value: font,
                    label: t(
                      `wechat.font${font[0].toUpperCase()}${font.slice(1)}` as "wechat.fontSans",
                    ),
                    sample: <span style={{ fontFamily: wechatFontStack(font) }}>Aa 文</span>,
                  }))}
                  onChange={(fontFamily) => setWechat({ fontFamily })}
                  columns={4}
                />
                <div className="space-y-4">
                  <SliderField
                    label={t("wechat.fontSize")}
                    value={wechat.fontSize}
                    min={12}
                    max={22}
                    suffix="px"
                    presets={[14, 16, 18, 22]}
                    onChange={(fontSize) => setWechat({ fontSize })}
                  />
                  <SliderField
                    label={t("wechat.fontWeight")}
                    value={wechat.fontWeight}
                    min={200}
                    max={900}
                    step={100}
                    presets={[300, 400, 500, 700]}
                    onChange={(fontWeight) => setWechat({ fontWeight })}
                  />
                  <SliderField
                    label={t("wechat.letterSpacing")}
                    value={wechat.letterSpacing}
                    min={0}
                    max={3}
                    step={0.1}
                    suffix="px"
                    presets={[0, 1, 2, 3]}
                    onChange={(letterSpacing) => setWechat({ letterSpacing })}
                  />
                  <SliderField
                    label={t("wechat.lineHeight")}
                    value={wechat.lineHeight}
                    min={1.2}
                    max={2.6}
                    step={0.1}
                    presets={[1.1, 1.7, 2.1, 2.5]}
                    presetFormat={(value) => `${value}×`}
                    onChange={(lineHeight) => setWechat({ lineHeight })}
                  />
                </div>
                <SliderField
                  label={t("wechat.paragraphSpacing")}
                  value={wechat.paragraphSpacing}
                  min={0}
                  max={48}
                  suffix="px"
                  onChange={(paragraphSpacing) => setWechat({ paragraphSpacing })}
                />
                <SectionToggle
                  label={t("wechat.textIndent")}
                  checked={wechat.textIndent}
                  onChange={(textIndent) => setWechat({ textIndent })}
                />
              </SettingCard>
              <SettingCard
                id="wechat-text-elements"
                title={t("wechat.textElements")}
                description={t("wechat.textElementsDesc")}
              >
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<p>${example.paragraph1} <strong>${example.bold}</strong>，<em>${example.italic}</em>，<del>${example.strike}</del>，<a href="#wechat-example-link">${example.link}</a>。</p>`}
                  style={contentPreviewStyle}
                  testId="wechat-text-elements"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorControl
                    label={t("wechat.strongColor")}
                    value={wechat.strongColor}
                    fallback={palette.headingColor}
                    onChange={(strongColor) => setWechat({ strongColor })}
                  />
                  <ColorControl
                    label={t("wechat.strongHighlight")}
                    value={wechat.strongHighlight}
                    fallback={wechat.accentColor}
                    onChange={(strongHighlight) => setWechat({ strongHighlight })}
                  />
                  <ColorControl
                    label={t("wechat.italicColor")}
                    value={wechat.italicColor}
                    fallback={wechat.textColor}
                    onChange={(italicColor) => setWechat({ italicColor })}
                  />
                  <ColorControl
                    label={t("wechat.deleteColor")}
                    value={wechat.deleteColor}
                    fallback="#999999"
                    onChange={(deleteColor) => setWechat({ deleteColor })}
                  />
                  <ColorControl
                    label={t("wechat.linkColor")}
                    value={wechat.linkColor}
                    fallback={palette.linkColor}
                    onChange={(linkColor) => setWechat({ linkColor })}
                  />
                  <ChoiceGrid<LinkUnderline>
                    label={t("wechat.linkUnderline")}
                    value={wechat.linkUnderline}
                    options={[
                      { value: "solid", label: t("wechat.lineSolid") },
                      { value: "dashed", label: t("wechat.lineDashed") },
                      { value: "none", label: t("wechat.lineNone") },
                    ]}
                    onChange={(linkUnderline) => setWechat({ linkUnderline })}
                    columns={3}
                  />
                </div>
                {wechat.strongHighlight ? (
                  <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-3">
                    <ChoiceGrid<StrongHighlightHeight>
                      label={t("wechat.highlightHeight")}
                      value={wechat.strongHighlightHeight}
                      options={STRONG_HIGHLIGHT_HEIGHTS.map((value) => ({
                        value,
                        label: t(
                          `wechat.highlight${value
                            .split("-")
                            .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
                            .join("")}` as "wechat.highlightFull",
                        ),
                        sample: (
                          <span
                            style={{
                              background: strongHighlightBackground(
                                wechat.strongHighlight,
                                value,
                                wechat.strongHighlightOpacity,
                              ),
                            }}
                          >
                            Aa
                          </span>
                        ),
                      }))}
                      onChange={(strongHighlightHeight) => setWechat({ strongHighlightHeight })}
                      columns={4}
                    />
                    <SliderField
                      label={t("wechat.highlightOpacity")}
                      value={wechat.strongHighlightOpacity}
                      min={0.1}
                      max={1}
                      step={0.05}
                      onChange={(strongHighlightOpacity) => setWechat({ strongHighlightOpacity })}
                    />
                  </div>
                ) : null}
              </SettingCard>
              <SettingCard
                id="wechat-list-settings"
                title={t("wechat.listSettings")}
                description={t("wechat.listSettingsDesc")}
              >
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<ul><li>${example.list1}</li><li>${example.list2}</li></ul><ol><li>${example.list1}</li><li>${example.list2}</li></ol>`}
                  style={contentPreviewStyle}
                  testId="wechat-lists"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChoiceGrid
                    label={t("wechat.unorderedListStyle")}
                    value={wechat.unorderedListStyle}
                    columns={3}
                    options={[
                      { value: "disc", label: t("wechat.listStyleDisc") },
                      { value: "circle", label: t("wechat.listStyleCircle") },
                      { value: "square", label: t("wechat.listStyleSquare") },
                    ]}
                    onChange={(unorderedListStyle) => setWechat({ unorderedListStyle })}
                  />
                  <ChoiceGrid
                    label={t("wechat.orderedListStyle")}
                    value={wechat.orderedListStyle}
                    columns={2}
                    options={[
                      { value: "decimal", label: "1. 2. 3." },
                      { value: "lower-alpha", label: "a. b. c." },
                      { value: "lower-roman", label: "i. ii. iii." },
                      { value: "cjk-ideographic", label: "一、二、三" },
                    ]}
                    onChange={(orderedListStyle) => setWechat({ orderedListStyle })}
                  />
                </div>
                <SliderField
                  label={t("wechat.listPadding")}
                  value={wechat.listPadding}
                  min={12}
                  max={56}
                  suffix="px"
                  onChange={(listPadding) => setWechat({ listPadding })}
                />
                <SliderField
                  label={t("wechat.listSpacing")}
                  value={wechat.listSpacing}
                  min={0}
                  max={16}
                  suffix="px"
                  presets={[0, 4, 8, 12]}
                  onChange={(listSpacing) => setWechat({ listSpacing })}
                />
              </SettingCard>
              <SettingCard id="wechat-quote-settings" title={t("wechat.quoteSettings")}>
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<blockquote>${example.quote}</blockquote>`}
                  style={contentPreviewStyle}
                  testId="wechat-quote"
                />
                <ChoiceGrid<QuoteStyle>
                  label={t("wechat.quoteStyle")}
                  value={wechat.quoteStyle}
                  options={[
                    { value: "bar", label: t("wechat.quoteBar") },
                    { value: "card", label: t("wechat.quoteCard") },
                  ]}
                  onChange={(quoteStyle) => setWechat({ quoteStyle })}
                  columns={2}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorControl
                    label={t("wechat.quoteBackground")}
                    value={wechat.quoteBackground}
                    fallback={palette.quoteBackground}
                    onChange={(quoteBackground) => setWechat({ quoteBackground })}
                  />
                  <SliderField
                    label={t("wechat.quoteRadius")}
                    value={wechat.quoteRadius}
                    min={0}
                    max={32}
                    suffix="px"
                    onChange={(quoteRadius) => setWechat({ quoteRadius })}
                  />
                  <SliderField
                    label={t("wechat.quotePadding")}
                    value={wechat.quotePadding}
                    min={0}
                    max={32}
                    suffix="px"
                    onChange={(quotePadding) => setWechat({ quotePadding })}
                  />
                  <SliderField
                    label={t("wechat.quoteSpacing")}
                    value={wechat.quoteSpacing}
                    min={0}
                    max={48}
                    suffix="px"
                    onChange={(quoteSpacing) => setWechat({ quoteSpacing })}
                  />
                  {wechat.quoteStyle === "bar" ? (
                    <>
                      <SliderField
                        label={t("wechat.quoteBorderWidth")}
                        value={wechat.quoteBorderWidth}
                        min={0}
                        max={12}
                        suffix="px"
                        onChange={(quoteBorderWidth) => setWechat({ quoteBorderWidth })}
                      />
                      <ColorControl
                        label={t("wechat.quoteBorderColor")}
                        value={wechat.quoteBorderColor}
                        fallback={wechat.accentColor}
                        onChange={(quoteBorderColor) => setWechat({ quoteBorderColor })}
                      />
                    </>
                  ) : null}
                </div>
              </SettingCard>
              <SettingCard id="wechat-code-settings" title={t("wechat.codeSettings")}>
                <WechatSettingExample
                  label={t("common.examplePreview")}
                  html={`<p>${example.paragraph1} <code>${example.inlineCode}</code></p><pre><code>const publish = () =&gt; "FasType";</code></pre>`}
                  style={contentPreviewStyle}
                  testId="wechat-code"
                />
                <ChoiceGrid<"light" | "dark">
                  label={t("wechat.codeStyle")}
                  value={wechat.codeStyle}
                  options={[
                    { value: "light", label: t("wechat.codeLight") },
                    { value: "dark", label: t("wechat.codeDark") },
                  ]}
                  onChange={(codeStyle) => setWechat({ codeStyle })}
                  columns={2}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorControl
                    label={t("wechat.codeBackground")}
                    value={wechat.codeBackground}
                    fallback={palette.codeBackground}
                    onChange={(codeBackground) => setWechat({ codeBackground })}
                  />
                  <ColorControl
                    label={t("wechat.codeTextColor")}
                    value={wechat.codeTextColor}
                    fallback={palette.codeText}
                    onChange={(codeTextColor) => setWechat({ codeTextColor })}
                  />
                  <SliderField
                    label={t("wechat.codeFontSize")}
                    value={wechat.codeFontSize}
                    min={10}
                    max={18}
                    suffix="px"
                    onChange={(codeFontSize) => setWechat({ codeFontSize })}
                  />
                  <SliderField
                    label={t("wechat.codeRadius")}
                    value={wechat.codeRadius}
                    min={0}
                    max={24}
                    suffix="px"
                    onChange={(codeRadius) => setWechat({ codeRadius })}
                  />
                  <ColorControl
                    label={t("wechat.inlineCodeBackground")}
                    value={wechat.inlineCodeBackground}
                    fallback={palette.inlineCodeBackground}
                    onChange={(inlineCodeBackground) => setWechat({ inlineCodeBackground })}
                  />
                  <ColorControl
                    label={t("wechat.inlineCodeColor")}
                    value={wechat.inlineCodeColor}
                    fallback={palette.inlineCodeColor}
                    onChange={(inlineCodeColor) => setWechat({ inlineCodeColor })}
                  />
                </div>
              </SettingCard>
            </div>
          ) : null}

          {activeTab === "enhance" ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <SettingCard
                id="wechat-identity-card"
                title={t("wechat.identityCard")}
                description={t("wechat.identityCardDesc")}
                action={
                  <Switch
                    checked={wechat.identityCard.enabled}
                    onCheckedChange={(enabled) => setIdentity({ enabled })}
                    aria-label={t("wechat.enableIdentityCard")}
                  />
                }
              >
                {wechat.identityCard.enabled ? (
                  <div className="space-y-4">
                    <WechatSettingExample
                      label={t("common.examplePreview")}
                      html={`<h1>${example.h1}</h1><p>${example.paragraph1}</p>`}
                      style={identityPreviewStyle}
                      profile={profile}
                      testId="wechat-identity-card"
                    />
                    <ProfileCard
                      onClick={onEditProfile}
                      hint={t("wechat.profileSynced")}
                      className="bg-background"
                    />

                    <CardGroupLabel>{t("wechat.cardContentGroup")}</CardGroupLabel>
                    <div className="space-y-3">
                      <CardField
                        label={t("wechat.cardBadge")}
                        align={wechat.identityCard.badgeAlign}
                        onAlignChange={(badgeAlign) => setIdentity({ badgeAlign })}
                      >
                        <CardInput
                          label={t("wechat.cardBadge")}
                          value={wechat.identityCard.badge}
                          onChange={(badge) => setIdentity({ badge })}
                        />
                      </CardField>
                      <CardField
                        label={t("wechat.cardTitle")}
                        align={wechat.identityCard.titleAlign}
                        onAlignChange={(titleAlign) => setIdentity({ titleAlign })}
                        hint={t("wechat.cardTitleAutoHint")}
                      >
                        <CardInput
                          label={t("wechat.cardTitle")}
                          value={wechat.identityCard.title}
                          placeholder={derivedCard.title}
                          onChange={(title) => setIdentity({ title })}
                        />
                      </CardField>
                      <CardField
                        label={t("wechat.cardSubtitle")}
                        align={wechat.identityCard.subtitleAlign}
                        onAlignChange={(subtitleAlign) => setIdentity({ subtitleAlign })}
                        hint={t("wechat.cardSubtitleAutoHint")}
                      >
                        <CardInput
                          label={t("wechat.cardSubtitle")}
                          value={wechat.identityCard.subtitle}
                          placeholder={derivedCard.subtitle}
                          onChange={(subtitle) => setIdentity({ subtitle })}
                        />
                      </CardField>
                      <CardField
                        label={t("wechat.cardSlogan")}
                        align={wechat.identityCard.sloganAlign}
                        onAlignChange={(sloganAlign) => setIdentity({ sloganAlign })}
                      >
                        <CardInput
                          label={t("wechat.cardSlogan")}
                          value={profile?.slogan ?? ""}
                          readOnly
                          onChange={() => {}}
                        />
                      </CardField>
                      <CardField
                        label={t("wechat.cardTag")}
                        align={wechat.identityCard.authorAlign}
                        onAlignChange={(authorAlign) => setIdentity({ authorAlign })}
                      >
                        <CardInput
                          label={t("wechat.cardTag")}
                          value={wechat.identityCard.tag}
                          placeholder={t("wechat.cardTagPlaceholder")}
                          onChange={(tag) => setIdentity({ tag })}
                        />
                      </CardField>
                      <SectionToggle
                        label={t("wechat.hideArticleTitle")}
                        checked={wechat.identityCard.hideTitle}
                        onChange={(hideTitle) => setIdentity({ hideTitle })}
                      />
                    </div>

                    <div className="border-t border-border/70" />

                    <CardGroupLabel>{t("wechat.cardStyleGroup")}</CardGroupLabel>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ColorControl
                        label={t("wechat.cardBackground")}
                        value={wechat.identityCard.backgroundColor}
                        fallback={palette.titleBg}
                        onChange={(backgroundColor) => setIdentity({ backgroundColor })}
                      />
                      <ColorControl
                        label={t("wechat.cardTextColor")}
                        value={wechat.identityCard.textColor}
                        fallback={palette.titleColor}
                        onChange={(textColor) => setIdentity({ textColor })}
                      />
                      <SliderField
                        label={t("wechat.cardRadius")}
                        value={wechat.identityCard.borderRadius}
                        min={0}
                        max={32}
                        suffix="px"
                        onChange={(borderRadius) => setIdentity({ borderRadius })}
                      />
                      <SliderField
                        label={t("wechat.cardTitleSize")}
                        value={wechat.identityCard.titleFontSize}
                        min={20}
                        max={36}
                        suffix="px"
                        onChange={(titleFontSize) => setIdentity({ titleFontSize })}
                      />
                      <SliderField
                        label={t("wechat.cardSubtitleSize")}
                        value={wechat.identityCard.subtitleFontSize}
                        min={12}
                        max={20}
                        suffix="px"
                        onChange={(subtitleFontSize) => setIdentity({ subtitleFontSize })}
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => setIdentity({ ...DEFAULT_IDENTITY_CARD, enabled: true })}
                    >
                      <RotateCcw className="size-3" />
                      {t("wechat.cardReset")}
                    </Button>
                  </div>
                ) : null}
              </SettingCard>
              <SettingCard
                id="wechat-tail-guide"
                title={t("wechat.tailGuide")}
                description={t("wechat.tailGuideDesc")}
                action={
                  <Switch
                    checked={wechat.tailGuide.enabled}
                    onCheckedChange={(enabled) => setTail({ enabled })}
                    aria-label={t("wechat.enableTailGuide")}
                  />
                }
              >
                {wechat.tailGuide.enabled ? (
                  <div className="space-y-4">
                    <WechatSettingExample
                      label={t("common.examplePreview")}
                      html={`<p>${example.paragraph1}</p>`}
                      style={tailPreviewStyle}
                      profile={profile}
                      testId="wechat-tail-guide"
                    />
                    <TextControl
                      label={t("wechat.guideTitle")}
                      value={wechat.tailGuide.title}
                      onChange={(title) => setTail({ title })}
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(
                        [
                          [
                            "like",
                            wechat.tailGuide.likeEmoji,
                            wechat.tailGuide.likeText,
                            wechat.tailGuide.likeHighlight,
                          ],
                          [
                            "star",
                            wechat.tailGuide.starEmoji,
                            wechat.tailGuide.starText,
                            wechat.tailGuide.starHighlight,
                          ],
                          [
                            "read",
                            wechat.tailGuide.readEmoji,
                            wechat.tailGuide.readText,
                            wechat.tailGuide.readHighlight,
                          ],
                        ] as const
                      ).map(([kind, emoji, text, highlighted]) => (
                        <div
                          key={kind}
                          className={cn(
                            "space-y-2 rounded-lg border p-3",
                            highlighted && "border-brand-primary/60 bg-brand-primary/5",
                          )}
                        >
                          <SectionToggle
                            label={t("wechat.guideHighlight")}
                            checked={highlighted}
                            onChange={(checked) =>
                              setTail({ [`${kind}Highlight`]: checked } as Partial<TailGuideStyle>)
                            }
                          />
                          <TextControl
                            label={t(
                              `wechat.guide${kind[0].toUpperCase()}${kind.slice(1)}Emoji` as "wechat.guideLikeEmoji",
                            )}
                            value={emoji}
                            onChange={(value) =>
                              setTail({ [`${kind}Emoji`]: value } as Partial<TailGuideStyle>)
                            }
                          />
                          <TextControl
                            label={t(
                              `wechat.guide${kind[0].toUpperCase()}${kind.slice(1)}Text` as "wechat.guideLikeText",
                            )}
                            value={text}
                            onChange={(value) =>
                              setTail({ [`${kind}Text`]: value } as Partial<TailGuideStyle>)
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <Field label={t("wechat.guideAuthorAlign")}>
                      <Select
                        value={wechat.tailGuide.authorAlign}
                        onValueChange={(authorAlign) =>
                          setTail({ authorAlign: authorAlign as GuideAuthorAlign })
                        }
                      >
                        <SelectTrigger aria-label={t("wechat.guideAuthorAlign")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GUIDE_AUTHOR_ALIGNS.map((align) => (
                            <SelectItem key={align} value={align}>
                              {t(
                                `wechat.guideAuthor${align[0].toUpperCase()}${align.slice(1)}` as "wechat.guideAuthorLeft",
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <TextControl
                      label={t("wechat.guideFooter")}
                      value={wechat.tailGuide.footerText}
                      onChange={(footerText) => setTail({ footerText })}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ColorControl
                        label={t("wechat.cardBackground")}
                        value={wechat.tailGuide.backgroundColor}
                        fallback={palette.titleBg}
                        onChange={(backgroundColor) => setTail({ backgroundColor })}
                      />
                      <ColorControl
                        label={t("wechat.cardTextColor")}
                        value={wechat.tailGuide.textColor}
                        fallback={palette.titleColor}
                        onChange={(textColor) => setTail({ textColor })}
                      />
                    </div>
                  </div>
                ) : null}
              </SettingCard>
              <div className="rounded-lg border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                <Sparkles className="mb-2 size-4 text-brand-primary" />
                {t("wechat.localFeatureNote")}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
