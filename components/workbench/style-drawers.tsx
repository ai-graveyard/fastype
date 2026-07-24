"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Image as ImageIcon,
  Palette,
  RotateCcw,
  Trash2,
  Type,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useT } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ColorField, Field, Label, Separator, SliderField, Switch } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TKey } from "@/lib/i18n";
import { CUSTOM_THEME_DRAFT_ID, type SavedCustomTheme } from "@/lib/themes/custom";
import {
  FONT_CHOICES,
  fontStack,
  HEADING_NUMBER_LABEL_POSITIONS,
  HEADING_NUMBER_POSITIONS,
  type FontChoice,
  type HeadingNumberLabelPosition,
  type HeadingNumberPosition,
} from "@/lib/themes/types";
import {
  CODE_STYLES,
  HEADING_TEMPLATES,
  QUOTE_STYLES,
  WECHAT_FONT_CHOICES,
  WECHAT_THEMES,
  getWechatTheme,
  type WechatStyle,
  type CodeStyle,
  type HeadingTemplate,
  type QuoteStyle,
  type WechatTheme,
} from "@/lib/themes/wechat";
import {
  XHS_BODY_TITLE_MAX_LENGTH,
  XHS_HEADING_TEMPLATES,
  XHS_PAGE_NUMBER_SCALE_RANGE,
  XHS_THEMES,
  getXhsTheme,
  type XhsStyle,
  type XhsHeadingLevelStyle,
  type XhsHeadingTemplate,
  type XhsTextAlign,
  type XhsTheme,
} from "@/lib/themes/xhs";
import { cn } from "@/lib/utils";

const FONT_LABEL_KEYS: Record<FontChoice, TKey> = {
  sans: "xhs.fontSans",
  serif: "xhs.fontSerif",
  hei: "xhs.fontHei",
  kai: "xhs.fontKai",
  fangsong: "xhs.fontFangsong",
  rounded: "xhs.fontRounded",
  mono: "xhs.fontMono",
  xingkai: "xhs.fontXingkai",
  lishu: "xhs.fontLishu",
  youyuan: "xhs.fontYouyuan",
  xinwei: "xhs.fontXinwei",
  hupo: "xhs.fontHupo",
};

const HEADING_TEMPLATE_LABELS: Record<XhsHeadingTemplate, TKey> = {
  classic: "xhs.headingClassic",
  highlight: "xhs.headingHighlight",
  underline: "xhs.headingUnderline",
  accent: "xhs.headingAccent",
  block: "xhs.headingBlock",
  elegant: "xhs.headingElegant",
  dot: "xhs.headingDot",
  corner: "xhs.headingCorner",
};


export function AlignPicker({
  value,
  onChange,
  label,
}: {
  value: XhsTextAlign;
  onChange: (value: XhsTextAlign) => void;
  label: string;
}) {
  const options = [
    { value: "left" as const, icon: AlignLeft },
    { value: "center" as const, icon: AlignCenter },
    { value: "right" as const, icon: AlignRight },
  ];
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {options.map(({ value: option, icon: Icon }) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md border transition-colors",
              value === option
                ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                : "border-border hover:bg-accent",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeadingTemplatePicker({
  value,
  onChange,
}: {
  value: XhsHeadingTemplate;
  onChange: (value: XhsHeadingTemplate) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("xhs.headingTemplate")}</p>
      <div className="grid grid-cols-4 gap-2">
        {XHS_HEADING_TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onChange(template)}
            className={cn(
              "rounded-lg border p-2 text-left transition-colors",
              value === template
                ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                : "border-border hover:bg-accent",
            )}
          >
            <span className="mb-2 flex h-9 items-center justify-center rounded bg-muted px-1">
              <span
                className={cn(
                  "text-xs font-bold",
                  template === "highlight" && "rounded bg-brand-primary px-2 py-1 text-white",
                  template === "underline" && "border-b-2 border-brand-primary pb-0.5",
                  template === "accent" && "border-l-2 border-brand-primary pl-1.5",
                  template === "block" && "rounded-full border border-brand-primary px-2 py-0.5",
                  template === "elegant" && "before:mr-1 before:inline-block before:w-2 before:border-t before:border-brand-primary after:ml-1 after:inline-block after:w-2 after:border-t after:border-brand-primary",
                  template === "dot" && "flex items-center gap-1.5 before:inline-block before:size-1.5 before:rounded-full before:bg-brand-primary",
                  template === "corner" &&
                    "relative px-2.5 py-1 before:absolute before:left-0 before:top-0 before:size-2 before:border-l-2 before:border-t-2 before:border-brand-primary after:absolute after:bottom-0 after:right-0 after:size-2 after:border-b-2 after:border-r-2 after:border-brand-primary",
                )}
              >
                {t("xhs.headingPreview")}
              </span>
            </span>
            <span className="block truncate text-center text-[11px] text-muted-foreground">
              {t(HEADING_TEMPLATE_LABELS[template])}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberPositionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs transition-colors",
              value === option.value
                ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                : "border-border hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeadingLevelEditor({
  level,
  value,
  accentColor,
  textColor,
  onChange,
  onReset,
  titleOverride,
  onTitleOverrideChange,
}: {
  level: "h1" | "h2" | "h3";
  value: XhsHeadingLevelStyle;
  accentColor: string;
  textColor: string;
  onChange: (patch: Partial<XhsHeadingLevelStyle>) => void;
  /** 把该级别的字号、间距、字重等样式恢复到当前主题的默认值。 */
  onReset?: () => void;
  /** 仅一级标题支持独立于 Markdown 正文的自定义标题文字。 */
  titleOverride?: string;
  onTitleOverrideChange?: (value: string) => void;
}) {
  const t = useT();
  const numberingId = React.useId();
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t(`xhs.${level}` as TKey)}</p>
        {onReset ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onReset}
            title={t("xhs.headingReset")}
            aria-label={t("xhs.headingReset")}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
      {onTitleOverrideChange ? (
        <Field label={t("xhs.bodyTitleOverride")} hint={t("xhs.bodyTitleOverrideHint")}>
          <textarea
            value={titleOverride ?? ""}
            maxLength={XHS_BODY_TITLE_MAX_LENGTH}
            rows={2}
            placeholder={t("xhs.bodyTitleOverridePlaceholder")}
            onChange={(event) => onTitleOverrideChange(event.target.value)}
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </Field>
      ) : null}
      <SliderField
        label={t("xhs.headingScale")}
        value={value.scale}
        min={0.7}
        max={2.4}
        step={0.05}
        onChange={(scale) => onChange({ scale })}
      />
      <SliderField
        label={t("xhs.headingSpacing")}
        value={value.spacing}
        min={0.4}
        max={2.2}
        step={0.1}
        onChange={(spacing) => onChange({ spacing })}
      />
      <SliderField
        label={t("xhs.headingWeight")}
        value={value.weight}
        min={400}
        max={900}
        step={50}
        onChange={(weight) => onChange({ weight })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label={t("xhs.headingBackground")}
          value={value.background || accentColor}
          themeColor={accentColor}
          onChange={(background) => onChange({ background })}
        />
        <ColorField
          label={t("xhs.headingTextColor")}
          value={value.textColor || textColor}
          themeColor={textColor}
          onChange={(nextTextColor) => onChange({ textColor: nextTextColor })}
        />
      </div>
      <div className="grid grid-cols-2 items-start gap-4">
        <AlignPicker
          label={t("xhs.headingAlign")}
          value={value.align}
          onChange={(align) => onChange({ align })}
        />
        <div className="flex h-9 items-center justify-between gap-2 self-end">
          <Label htmlFor={numberingId}>{t("xhs.headingNumbering")}</Label>
          <Switch
            id={numberingId}
            aria-label={t("xhs.headingNumbering")}
            checked={value.number.enabled}
            onCheckedChange={(enabled) => onChange({ number: { ...value.number, enabled } })}
          />
        </div>
      </div>
      {value.number.enabled ? (
        <div className="space-y-3 border-t border-border pt-3">
          <NumberPositionPicker<HeadingNumberPosition>
            label={t("xhs.headingNumberPosition")}
            value={value.number.position}
            options={HEADING_NUMBER_POSITIONS.map((position) => ({
              value: position,
              label: t(
                `xhs.number${position[0].toUpperCase()}${position.slice(1)}` as "xhs.numberBehind",
              ),
            }))}
            onChange={(position) => onChange({ number: { ...value.number, position } })}
          />
          <SliderField
            label={t("xhs.headingNumberSize")}
            value={value.number.sizeMultiplier}
            min={1}
            max={5}
            step={0.1}
            onChange={(sizeMultiplier) => onChange({ number: { ...value.number, sizeMultiplier } })}
          />
          <SliderField
            label={t("xhs.headingNumberOpacity")}
            value={value.number.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(opacity) => onChange({ number: { ...value.number, opacity } })}
          />
          <ColorField
            label={t("xhs.headingNumberColor")}
            value={value.number.color}
            themeColor={accentColor}
            onChange={(color) => onChange({ number: { ...value.number, color } })}
          />
          <Field label={t("xhs.headingLabelText")}>
            <input
              value={value.number.labelText}
              placeholder="PART"
              onChange={(event) =>
                onChange({ number: { ...value.number, labelText: event.target.value } })
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </Field>
          {value.number.labelText ? (
            <>
              <NumberPositionPicker<HeadingNumberLabelPosition>
                label={t("xhs.headingLabelPosition")}
                value={value.number.labelPosition}
                options={HEADING_NUMBER_LABEL_POSITIONS.map((position) => ({
                  value: position,
                  label: t(
                    `xhs.number${position[0].toUpperCase()}${position.slice(1)}` as "xhs.numberBehind",
                  ),
                }))}
                onChange={(labelPosition) => onChange({ number: { ...value.number, labelPosition } })}
              />
              <SliderField
                label={t("xhs.headingLabelSize")}
                value={value.number.labelSizeMultiplier}
                min={0.4}
                max={1.5}
                step={0.1}
                onChange={(labelSizeMultiplier) =>
                  onChange({ number: { ...value.number, labelSizeMultiplier } })
                }
              />
              <SliderField
                label={t("xhs.headingLabelOpacity")}
                value={value.number.labelOpacity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(labelOpacity) =>
                  onChange({ number: { ...value.number, labelOpacity } })
                }
              />
              <ColorField
                label={t("xhs.headingLabelColor")}
                value={value.number.labelColor}
                themeColor={value.number.color || accentColor}
                onChange={(labelColor) => onChange({ number: { ...value.number, labelColor } })}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface ThemePreviewColors {
  pageBackground: string;
  pageBorderColor: string;
  titleBackground: string;
  sectionBackground: string;
  textColor: string;
  accentColor: string;
}

function themePreviewColors(
  theme: XhsTheme | WechatTheme,
  variant: "xhs" | "wechat",
): ThemePreviewColors {
  if (variant === "xhs") {
    const xhsTheme = theme as XhsTheme;
    return {
      ...xhsTheme.preview,
      textColor: xhsTheme.defaults.textColor,
      accentColor: xhsTheme.defaults.accentColor,
    };
  }

  const wechatTheme = theme as WechatTheme;
  return {
    pageBackground: wechatTheme.defaults.pageBackground,
    pageBorderColor: wechatTheme.palette.pageBorderColor,
    titleBackground: wechatTheme.palette.titleBg,
    sectionBackground: wechatTheme.palette.sectionBg,
    textColor: wechatTheme.palette.headingColor,
    accentColor: wechatTheme.defaults.accentColor,
  };
}

function customThemePreviewColors(
  style: XhsStyle | WechatStyle,
  variant: "xhs" | "wechat",
): ThemePreviewColors {
  if (variant === "xhs") {
    const xhs = style as XhsStyle;
    const base = getXhsTheme(xhs.themeId).preview;
    return {
      pageBackground: xhs.background,
      pageBorderColor: base.pageBorderColor,
      titleBackground: xhs.accentColor,
      sectionBackground: base.sectionBackground,
      textColor: xhs.textColor,
      accentColor: xhs.accentColor,
    };
  }
  const wechat = style as WechatStyle;
  const base = getWechatTheme(wechat.themeId).palette;
  return {
    pageBackground: wechat.pageBackground,
    pageBorderColor: base.pageBorderColor,
    titleBackground: wechat.accentColor,
    sectionBackground: base.sectionBg,
    textColor: wechat.textColor,
    accentColor: wechat.accentColor,
  };
}

function ThemeSwatch({
  id,
  colors,
  variant,
  custom = false,
}: {
  id: string;
  colors: ThemePreviewColors;
  variant: "xhs" | "wechat";
  custom?: boolean;
}) {
  return (
    <span
      className="block overflow-hidden rounded-lg border"
      data-theme-preview={id}
      data-theme-variant={variant}
      style={{ backgroundColor: colors.pageBackground, borderColor: colors.pageBorderColor }}
    >
      {custom ? (
        <span className="flex h-5 items-center justify-center bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#06b6d4,#8b5cf6,#ec4899)]">
          <span className="flex size-3.5 items-center justify-center rounded-full bg-white/90 shadow-sm">
            <Palette className="size-2.5 text-slate-700" />
          </span>
        </span>
      ) : variant === "xhs" ? (
        <span className="block h-5" style={{ backgroundColor: colors.titleBackground }} />
      ) : (
        <span
          className="flex h-5 items-center justify-center text-[6px] font-bold"
          style={{ color: colors.textColor }}
        >
          Title
        </span>
      )}
      <span className="block space-y-1 px-2 py-2">
        <span className="block h-2 rounded-sm" style={{ backgroundColor: colors.sectionBackground }} />
        <span className="block h-1.5 w-4/5 rounded-sm" style={{ backgroundColor: colors.textColor, opacity: 0.22 }} />
        <span className="block h-1.5 w-3/4 rounded-sm" style={{ backgroundColor: colors.accentColor, opacity: 0.24 }} />
      </span>
    </span>
  );
}

/** 与 LovType 一致的主题缩略卡片：真实色板预览、名称和明确选中态。 */
export function ThemePicker({
  themes,
  value,
  onChange,
  label,
  variant,
  showLabel = true,
  customThemes = [],
  onCreateCustomTheme,
  onApplyCustomTheme,
  onSaveCustomTheme,
  onUpdateCustomTheme,
  onCopyTheme,
  onDeleteCustomTheme,
  isSelectedCustomThemeDirty = false,
}: {
  themes: Array<XhsTheme | WechatTheme>;
  value: string;
  onChange: (id: string) => void;
  label: string;
  variant: "xhs" | "wechat";
  showLabel?: boolean;
  customThemes?: Array<SavedCustomTheme<XhsStyle | WechatStyle>>;
  onCreateCustomTheme?: () => void;
  onApplyCustomTheme?: (id: string) => void;
  onSaveCustomTheme?: (name: string) => void;
  onUpdateCustomTheme?: (name: string) => void;
  onCopyTheme?: (id: string, name: string) => void;
  onDeleteCustomTheme?: (id: string) => void;
  isSelectedCustomThemeDirty?: boolean;
}) {
  const t = useT();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const selectedCustomTheme = customThemes.find((theme) => theme.id === value);
  const [nameDraft, setNameDraft] = React.useState(() => ({
    themeId: value,
    name: selectedCustomTheme?.name ?? "",
  }));
  const name =
    nameDraft.themeId === value ? nameDraft.name : (selectedCustomTheme?.name ?? "");
  const setName = (nextName: string) => setNameDraft({ themeId: value, name: nextName });

  const cardClass = (selected: boolean) =>
    cn(
      "w-full cursor-pointer rounded-xl border-2 p-2 text-left transition-all",
      selected
        ? "border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/15"
        : "border-border hover:border-muted-foreground/40",
    );

  return (
    <div className="space-y-2.5">
      {showLabel ? <p className="text-sm font-medium">{label}</p> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {themes.map((theme) => {
          const colors = themePreviewColors(theme, variant);
          const selected = value === theme.id;
          const themeLabel = t(theme.labelKey);
          return (
            <div key={theme.id} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={themeLabel}
                onClick={() => {
                  setNameDraft({ themeId: theme.id, name: "" });
                  onChange(theme.id);
                }}
                className={cardClass(selected)}
              >
                <ThemeSwatch id={theme.id} colors={colors} variant={variant} />
                <span className="mt-2 block truncate text-center text-[11px] leading-tight">{themeLabel}</span>
              </button>
              {onCopyTheme ? (
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full border bg-background/90 p-1 text-muted-foreground hover:text-primary"
                  aria-label={`${t("common.copyTheme")} ${themeLabel}`}
                  onClick={() => {
                    const copyName = `${themeLabel} ${t("common.copySuffix")}`;
                    setNameDraft({ themeId: "", name: copyName });
                    onCopyTheme(theme.id, copyName);
                  }}
                >
                  <Copy className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
        {onCreateCustomTheme ? (
          <button
            type="button"
            role="radio"
            aria-checked={value === CUSTOM_THEME_DRAFT_ID}
            aria-label={t("common.customTheme")}
            onClick={() => {
              setNameDraft({ themeId: CUSTOM_THEME_DRAFT_ID, name: "" });
              onCreateCustomTheme();
            }}
            className={cardClass(value === CUSTOM_THEME_DRAFT_ID)}
          >
            <ThemeSwatch
              id={CUSTOM_THEME_DRAFT_ID}
              colors={themePreviewColors(themes[0], variant)}
              variant={variant}
              custom
            />
            <span className="mt-2 block truncate text-center text-[11px] leading-tight">{t("common.customTheme")}</span>
          </button>
        ) : null}
        {customThemes.map((savedTheme) => {
          const selected = value === savedTheme.id;
          return (
            <div key={savedTheme.id} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={savedTheme.name}
                onClick={() => {
                  setNameDraft({ themeId: savedTheme.id, name: savedTheme.name });
                  onApplyCustomTheme?.(savedTheme.id);
                }}
                className={cardClass(selected)}
              >
                <ThemeSwatch id={savedTheme.id} colors={customThemePreviewColors(savedTheme.style, variant)} variant={variant} />
                <span className="mt-2 block truncate text-center text-[11px] leading-tight">{savedTheme.name}</span>
              </button>
              <span className="absolute right-1 top-1 flex gap-0.5">
                {onCopyTheme ? (
                  <button type="button" className="rounded-full border bg-background/90 p-1 text-muted-foreground hover:text-primary" aria-label={`${t("common.copyTheme")} ${savedTheme.name}`} onClick={() => { const copyName = `${savedTheme.name} ${t("common.copySuffix")}`; setNameDraft({ themeId: "", name: copyName }); onCopyTheme(savedTheme.id, copyName); }}><Copy className="size-3" /></button>
                ) : null}
                {onDeleteCustomTheme ? (
                  <button type="button" className="rounded-full border bg-background/90 p-1 text-muted-foreground hover:text-destructive" aria-label={`${t("common.deleteTheme")} ${savedTheme.name}`} onClick={() => setPendingDeleteId(savedTheme.id)}><Trash2 className="size-3" /></button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      {value === CUSTOM_THEME_DRAFT_ID || selectedCustomTheme ? (
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <label className="text-xs font-medium" htmlFor={`${variant}-custom-theme-name`}>{t("common.customThemeName")}</label>
          <div className="flex gap-2">
            <Input id={`${variant}-custom-theme-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("common.customThemeNamePlaceholder")} />
            {selectedCustomTheme ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { onSaveCustomTheme?.(name); toast.success(t("common.customThemeSaved")); }} disabled={!name.trim()}>{t("common.saveAsNewTheme")}</Button>
                <Button size="sm" onClick={() => { onUpdateCustomTheme?.(name); toast.success(t("common.customThemeUpdated")); }} disabled={!name.trim() || !isSelectedCustomThemeDirty}>{t("common.updateCurrentTheme")}</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => { onSaveCustomTheme?.(name); toast.success(t("common.customThemeSaved")); }} disabled={!name.trim()}>{t("common.saveCustomTheme")}</Button>
            )}
          </div>
        </div>
      ) : null}
      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogHeader><DialogTitle>{t("common.deleteTheme")}</DialogTitle><DialogDescription>{t("common.deleteThemeConfirm")}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPendingDeleteId(null)}>{t("common.cancel")}</Button><Button variant="destructive" onClick={() => { if (pendingDeleteId) onDeleteCustomTheme?.(pendingDeleteId); setPendingDeleteId(null); }}>{t("common.delete")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FontPicker({
  value,
  onChange,
}: {
  value: FontChoice;
  onChange: (font: FontChoice) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium">{t("xhs.fontFamily")}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {FONT_CHOICES.map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange(font)}
            className={cn(
              "relative cursor-pointer rounded-lg border-2 p-2 text-center transition-all",
              value === font ? "border-brand-primary ring-2 ring-brand-primary/20" : "border-border hover:border-muted-foreground/40",
            )}
          >
            <span className="block text-base leading-none" style={{ fontFamily: fontStack(font) }}>
              Aa {font === "sans" ? "现" : font === "serif" ? "宋" : font === "hei" ? "黑" : font === "kai" ? "楷" : font === "fangsong" ? "仿" : font === "rounded" ? "圆" : font === "mono" ? "等" : font === "xingkai" ? "行" : font === "lishu" ? "隶" : font === "youyuan" ? "幼" : font === "xinwei" ? "魏" : "琥"}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{t(FONT_LABEL_KEYS[font])}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function XhsStyleDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
  const xhsTheme = getXhsTheme(xhs.themeId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t("common.close")} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t("xhs.settings")}</SheetTitle>
          <SheetDescription>{t("settings.dataNotice")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <ThemePicker
            themes={XHS_THEMES}
            value={selectedXhsThemeId}
            onChange={setXhsTheme}
            label={t("xhs.theme")}
            variant="xhs"
            customThemes={xhsCustomThemes}
            onCreateCustomTheme={createXhsThemeDraft}
            onApplyCustomTheme={applyXhsCustomTheme}
            onSaveCustomTheme={saveXhsCustomTheme}
            onUpdateCustomTheme={updateXhsCustomTheme}
            onCopyTheme={copyXhsTheme}
            onDeleteCustomTheme={deleteXhsCustomTheme}
            isSelectedCustomThemeDirty={isSelectedXhsThemeDirty}
          />
          <Separator />
          <FontPicker value={xhs.fontFamily} onChange={(fontFamily) => setXhs({ fontFamily })} />
          <SliderField
            label={t("xhs.fontSize")}
            value={xhs.fontSize}
            min={24}
            max={60}
            suffix="px"
            onChange={(fontSize) => setXhs({ fontSize })}
          />
          <SliderField
            label={t("xhs.lineHeight")}
            value={xhs.lineHeight}
            min={1.3}
            max={2.6}
            step={0.05}
            onChange={(lineHeight) => setXhs({ lineHeight })}
          />
          <SliderField
            label={t("xhs.paragraphSpacing")}
            value={xhs.paragraphSpacing}
            min={0.3}
            max={1.6}
            step={0.05}
            onChange={(paragraphSpacing) => setXhs({ paragraphSpacing })}
          />
          <SliderField
            label={t("xhs.padding")}
            value={xhs.padding}
            min={32}
            max={160}
            suffix="px"
            onChange={(padding) => setXhs({ padding })}
          />
          <Separator />
          <ColorField
            label={t("xhs.background")}
            value={xhs.background}
            themeColor={xhsTheme.defaults.background}
            onChange={(background) => setXhs({ background })}
          />
          <ColorField
            label={t("xhs.textColor")}
            value={xhs.textColor}
            themeColor={xhsTheme.defaults.textColor}
            onChange={(textColor) => setXhs({ textColor })}
          />
          <ColorField
            label={t("xhs.accentColor")}
            value={xhs.accentColor}
            themeColor={xhsTheme.defaults.accentColor}
            onChange={(accentColor) => setXhs({ accentColor })}
          />
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
            onChange={(pageNumberScale) => setXhs({ pageNumberScale })}
          />
          <Separator />
          <div className="flex items-center gap-2">
            <Type className="size-4 text-brand-primary" />
            <p className="font-medium">{t("xhs.headingDesign")}</p>
          </div>
          <HeadingTemplatePicker
            value={xhs.headingTemplate}
            onChange={(headingTemplate) => setXhs({ headingTemplate })}
          />
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
            />
          ))}
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-brand-primary" />
              <div>
                <p className="font-medium">{t("xhs.bigTextCover")}</p>
                <p className="text-xs text-muted-foreground">{t("xhs.bigTextCoverHint")}</p>
              </div>
            </div>
            <Switch
              checked={xhs.cover.enabled}
              onCheckedChange={(enabled) =>
                setXhs({ cover: { ...xhs.cover, enabled } })
              }
              aria-label={t("xhs.bigTextCover")}
            />
          </div>
          <div
            className="flex aspect-[3/4] max-h-56 items-center rounded-lg border p-[4.5%]"
            style={{
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
            <p
              className="w-full whitespace-pre-wrap break-words"
              style={{
                textAlign: xhs.cover.align,
                fontSize: Math.max(18, xhs.cover.fontSize * 0.15),
                fontWeight: xhs.cover.fontWeight,
                lineHeight: 1.2,
              }}
            >
              {xhs.cover.text || t("xhs.coverAutoTitle")}
            </p>
          </div>
          <Field label={t("xhs.coverText")} hint={t("xhs.coverTextHint")}>
            <textarea
              value={xhs.cover.text}
              maxLength={120}
              rows={3}
              disabled={!xhs.cover.enabled}
              onChange={(event) =>
                setXhs({ cover: { ...xhs.cover, text: event.target.value } })
              }
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </Field>
          <AlignPicker
            label={t("xhs.coverAlign")}
            value={xhs.cover.align}
            onChange={(align) => setXhs({ cover: { ...xhs.cover, align } })}
          />
          <SliderField
            label={t("xhs.coverFontSize")}
            value={xhs.cover.fontSize}
            min={48}
            max={280}
            step={4}
            suffix="px"
            onChange={(fontSize) => setXhs({ cover: { ...xhs.cover, fontSize } })}
          />
          <SliderField
            label={t("xhs.coverFontWeight")}
            value={xhs.cover.fontWeight}
            min={400}
            max={900}
            step={100}
            onChange={(fontWeight) => setXhs({ cover: { ...xhs.cover, fontWeight } })}
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
            onChange={(textColor) => setXhs({ cover: { ...xhs.cover, textColor } })}
          />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span>{t("xhs.hideBodyTitle")}</span>
            <Switch
              checked={xhs.cover.hideBodyTitle}
              disabled={!xhs.cover.enabled}
              onCheckedChange={(hideBodyTitle) =>
                setXhs({ cover: { ...xhs.cover, hideBodyTitle } })
              }
            />
          </label>
          <Button variant="outline" className="w-full" onClick={resetXhs}>
            <RotateCcw />
            {t("xhs.resetTheme")}
          </Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function WechatStyleDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { wechat, setWechat, setWechatTheme, resetWechat } = useStyles();
  const wechatTheme = getWechatTheme(wechat.themeId);

  const headingLabels: Record<HeadingTemplate, TKey> = {
    classic: "wechat.headingPlain",
    highlight: "wechat.headingBadge",
    underline: "wechat.headingUnderline",
    accent: "wechat.headingBar",
    block: "wechat.headingBadge",
    elegant: "wechat.headingPlain",
    modern: "wechat.headingBadge",
    minimal: "wechat.headingPlain",
  };
  const quoteLabels: Record<QuoteStyle, TKey> = {
    bar: "wechat.quoteBar",
    card: "wechat.quoteCard",
  };
  const codeLabels: Record<CodeStyle, TKey> = {
    light: "wechat.codeLight",
    dark: "wechat.codeDark",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t("common.close")} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t("wechat.settings")}</SheetTitle>
          <SheetDescription>{t("settings.dataNotice")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <ThemePicker
            themes={WECHAT_THEMES}
            value={wechat.themeId}
            onChange={setWechatTheme}
            label={t("wechat.theme")}
            variant="wechat"
          />
          <Separator />
          <Field label={t("wechat.fontFamily")}>
            <Select
              value={wechat.fontFamily}
              onValueChange={(fontFamily) =>
                setWechat({ fontFamily: fontFamily as WechatStyle["fontFamily"] })
              }
            >
              <SelectTrigger aria-label={t("wechat.fontFamily")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WECHAT_FONT_CHOICES.map((font) => (
                  <SelectItem key={font} value={font}>
                    {t(
                      `wechat.font${font[0].toUpperCase()}${font.slice(1)}` as "wechat.fontSans",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <SliderField
            label={t("wechat.fontSize")}
            value={wechat.fontSize}
            min={12}
            max={22}
            suffix="px"
            onChange={(fontSize) => setWechat({ fontSize })}
          />
          <SliderField
            label={t("wechat.lineHeight")}
            value={wechat.lineHeight}
            min={1.3}
            max={2.4}
            step={0.05}
            onChange={(lineHeight) => setWechat({ lineHeight })}
          />
          <SliderField
            label={t("wechat.paragraphSpacing")}
            value={wechat.paragraphSpacing}
            min={4}
            max={48}
            suffix="px"
            onChange={(paragraphSpacing) => setWechat({ paragraphSpacing })}
          />
          <Separator />
          <ColorField
            label={t("wechat.textColor")}
            value={wechat.textColor}
            themeColor={wechatTheme.defaults.textColor}
            onChange={(textColor) => setWechat({ textColor })}
          />
          <ColorField
            label={t("wechat.accentColor")}
            value={wechat.accentColor}
            themeColor={wechatTheme.defaults.accentColor}
            onChange={(accentColor) => setWechat({ accentColor })}
          />
          <Separator />
          <Field label={t("wechat.headingStyle")}>
            <Select
              value={wechat.headingTemplate}
              onValueChange={(value) => setWechat({ headingTemplate: value as HeadingTemplate })}
            >
              <SelectTrigger aria-label={t("wechat.headingStyle")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADING_TEMPLATES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(headingLabels[option])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("wechat.quoteStyle")}>
            <Select
              value={wechat.quoteStyle}
              onValueChange={(value) => setWechat({ quoteStyle: value as QuoteStyle })}
            >
              <SelectTrigger aria-label={t("wechat.quoteStyle")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STYLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(quoteLabels[option])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("wechat.codeStyle")}>
            <Select
              value={wechat.codeStyle}
              onValueChange={(value) => setWechat({ codeStyle: value as CodeStyle })}
            >
              <SelectTrigger aria-label={t("wechat.codeStyle")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODE_STYLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(codeLabels[option])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button variant="outline" className="w-full" onClick={resetWechat}>
            <RotateCcw />
            {t("wechat.resetTheme")}
          </Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
