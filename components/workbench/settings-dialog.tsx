"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  Database,
  Eye,
  EyeOff,
  Info,
  Languages,
  Loader2,
  MessageSquareText,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import fastypeLogo from "@/public/fastype-logo.png";
import { useAi } from "@/components/providers/ai-provider";
import { useDocument } from "@/components/providers/document-provider";
import { usePrefs } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/brand-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label, Switch } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarCropDialog } from "@/components/workbench/avatar-crop-dialog";
import { testConnection } from "@/lib/ai/client";
import { chatCompletionsUrl } from "@/lib/ai/errors";
import {
  DEFAULT_AI_CONFIG,
  getDefaultAiConfig,
  getDefaultAiPrompts,
  parseAiConfig,
  type AiAction,
  type AiConfig,
} from "@/lib/ai/types";
import type { TKey } from "@/lib/i18n";
import { downloadText } from "@/lib/file";
import { clearAllRecords, readRecord, StorageKey, writeRecord } from "@/lib/storage";
import { emptyCustomThemeLibrary, parseCustomThemeLibrary } from "@/lib/themes/custom";
import { parseWechatStyle, DEFAULT_WECHAT_STYLE } from "@/lib/themes/wechat";
import { parseXhsStyle, DEFAULT_XHS_STYLE } from "@/lib/themes/xhs";
import { APP_VERSION, REPO_URL } from "@/lib/constants";
import { LOCALES, LOCALE_FULL_LABELS } from "@/lib/i18n";
import { getDefaultUserProfile, type UserProfile } from "@/lib/user-profile";
import { DEFAULT_WECHAT_COVER, parseWechatCover } from "@/lib/wechat-cover";
import type { ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClearTarget = "draft" | "styles" | "ai" | "all";
export type SettingsSection = "appearance" | "profile" | "ai" | "ai-prompt" | "data" | "about";

const MAX_AVATAR_BYTES = 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * 划词浮层里需要模型的动作，顺序与浮层工具条一致。
 * 「去格式」不在这里：它在本地剥 Markdown 标记，没有提示词可改。
 */
const SELECTION_PROMPTS: Array<{ action: AiAction; label: TKey; hint: TKey }> = [
  { action: "polish", label: "ai.polishPrompt", hint: "ai.polishPromptHint" },
  { action: "expand", label: "ai.expandPrompt", hint: "ai.expandPromptHint" },
  { action: "condense", label: "ai.condensePrompt", hint: "ai.condensePromptHint" },
  {
    action: "conversational",
    label: "ai.conversationalPrompt",
    hint: "ai.conversationalPromptHint",
  },
  { action: "custom", label: "ai.customPrompt", hint: "ai.customPromptHint" },
];

function SettingsCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card/80 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      {title || description || action ? (
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-border px-4 py-3">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection = "appearance",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
}) {
  const { t, locale, setLocale, themeMode, setThemeMode, resetPrefs } = usePrefs();
  const { config, configured, setConfig, clearConfig, settingsOpen, closeSettings } = useAi();
  const { clearDraft } = useDocument();
  const { clearStyles } = useStyles();
  const { profile, setProfile, resetProfile } = useUserProfile();
  const defaultProfile = React.useMemo(() => getDefaultUserProfile(locale), [locale]);

  const [draft, setDraft] = React.useState<AiConfig>(config);
  const [profileDraft, setProfileDraft] = React.useState<UserProfile>(profile);
  const [activeSection, setActiveSection] = React.useState<SettingsSection>(
    settingsOpen && !open ? "ai" : initialSection,
  );
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [includeKey, setIncludeKey] = React.useState(false);
  const [promptTab, setPromptTab] = React.useState<"humanize" | "sensitive" | "titles">("humanize");
  const [selectionPromptTab, setSelectionPromptTab] = React.useState<AiAction>("polish");
  const [clearTarget, setClearTarget] = React.useState<ClearTarget | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const importRef = React.useRef<HTMLInputElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const cropSrcRef = React.useRef<string | null>(null);

  // AI 面板的「现在配置」会直接打开弹框中的 AI 子菜单。
  const isOpen = open || settingsOpen;
  const setOpen = (next: boolean) => {
    if (!next) {
      closeSettings();
      closeCrop();
    }
    onOpenChange(next);
  };

  // 弹框每次打开时从已保存配置重新起草。这是 React 官方的「渲染期调整状态」写法，
  // 比在 effect 里 setState 少一轮渲染。
  const [wasOpen, setWasOpen] = React.useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(config);
      setProfileDraft(profile);
      setActiveSection(settingsOpen && !open ? "ai" : initialSection);
      setPromptTab("humanize");
    }
  }

  const closeCrop = React.useCallback(() => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  }, []);

  React.useEffect(
    () => () => {
      if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    },
    [],
  );

  const target = chatCompletionsUrl(draft.baseUrl);

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection(draft);
    setTesting(false);
    if (result.ok) {
      toast.success(t("ai.testOk", { model: draft.model }));
    } else {
      toast.error(t(result.error.messageKey, result.error.params));
    }
  };

  const handleSave = () => {
    const normalized = parseAiConfig(draft) ?? getDefaultAiConfig(locale);
    setDraft(normalized);
    setConfig(normalized);
    toast.success(t("ai.saved"));
  };

  const handleAvatar = (file: File) => {
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      toast.error(t("profile.imageTypeError"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("profile.imageSizeError"));
      return;
    }
    closeCrop();
    const src = URL.createObjectURL(file);
    cropSrcRef.current = src;
    setCropSrc(src);
  };

  const handleProfileSave = () => {
    const next = {
      avatar: profileDraft.avatar,
      name: profileDraft.name.trim() || defaultProfile.name,
      slogan: profileDraft.slogan.trim() || defaultProfile.slogan,
    };
    setProfile(next);
    setProfileDraft(next);
    toast.success(t("profile.saved"));
  };

  /** 导出配置默认不含 API Key，用户主动勾选才带上（PRD FT-SET-001）。 */
  const handleExportConfig = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      xhs: readRecord(StorageKey.xhsStyle, parseXhsStyle, DEFAULT_XHS_STYLE).value,
      xhsThemes: readRecord(
        StorageKey.xhsThemes,
        (raw) => parseCustomThemeLibrary(raw, parseXhsStyle),
        emptyCustomThemeLibrary(),
      ).value,
      wechat: readRecord(StorageKey.wechatStyle, parseWechatStyle, DEFAULT_WECHAT_STYLE).value,
      wechatCover: readRecord(StorageKey.wechatCover, parseWechatCover, DEFAULT_WECHAT_COVER).value,
      wechatThemes: readRecord(
        StorageKey.wechatThemes,
        (raw) => parseCustomThemeLibrary(raw, parseWechatStyle),
        emptyCustomThemeLibrary(),
      ).value,
      ai: includeKey ? config : { ...config, apiKey: "" },
    };
    downloadText(JSON.stringify(payload, null, 2), "fastype-settings.json", "application/json");
    toast.success(t("settings.exportConfigDone"));
  };

  const handleImportConfig = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const xhs = parseXhsStyle(parsed.xhs);
      const wechat = parseWechatStyle(parsed.wechat);
      const wechatCover = parseWechatCover(parsed.wechatCover);
      const xhsThemes = parseCustomThemeLibrary(parsed.xhsThemes, parseXhsStyle);
      const wechatThemes = parseCustomThemeLibrary(parsed.wechatThemes, parseWechatStyle);
      const ai = parseAiConfig(parsed.ai);
      if (!xhs && !wechat && !wechatCover && !xhsThemes && !wechatThemes && !parsed.ai)
        throw new Error("empty");
      // 逐项写入，坏掉的字段由各自的 parse 兜底。
      if (xhs) writeRecord(StorageKey.xhsStyle, xhs);
      if (xhsThemes) writeRecord(StorageKey.xhsThemes, xhsThemes);
      if (wechat) writeRecord(StorageKey.wechatStyle, wechat);
      if (wechatCover) writeRecord(StorageKey.wechatCover, wechatCover);
      if (wechatThemes) writeRecord(StorageKey.wechatThemes, wechatThemes);
      if (ai) setConfig(ai);
      toast.success(t("settings.importConfigDone"));
      // 样式 provider 在下次挂载时读取，这里直接刷新最稳妥。
      window.location.reload();
    } catch (error) {
      toast.error(
        t("settings.importConfigFailed", {
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  const runClear = () => {
    if (clearTarget === "draft") clearDraft();
    if (clearTarget === "styles") clearStyles();
    if (clearTarget === "ai") clearConfig();
    if (clearTarget === "all") {
      clearAllRecords();
      clearDraft();
      clearStyles();
      clearConfig();
      resetPrefs();
      resetProfile();
    }
    setClearTarget(null);
    toast.success(t("settings.cleared"));
  };

  const clearDescriptions: Record<ClearTarget, string> = {
    draft: t("settings.clearDraftDesc"),
    styles: t("settings.clearStylesDesc"),
    ai: t("settings.clearAiDesc"),
    all: t("settings.clearAllDesc"),
  };
  const navigation = [
    { id: "appearance" as const, label: t("settings.appearance"), icon: Palette },
    { id: "profile" as const, label: t("profile.title"), icon: UserRound },
    { id: "ai" as const, label: t("settings.aiBasic"), icon: Bot },
    { id: "ai-prompt" as const, label: t("settings.aiPrompts"), icon: MessageSquareText },
    { id: "data" as const, label: t("settings.data"), icon: Database },
    { id: "about" as const, label: t("settings.about"), icon: Info },
  ];
  const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: t("settings.themeLight"), icon: Sun },
    { id: "dark", label: t("settings.themeDark"), icon: Moon },
    { id: "system", label: t("settings.themeSystem"), icon: Monitor },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent
          className="h-[min(720px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
          closeLabel={t("common.close")}
        >
          <DialogHeader className="border-b border-dashed bg-background/45 px-5 py-3.5 pr-14">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="size-4 text-brand-primary" />
              {t("settings.title")}
            </DialogTitle>
            <DialogDescription className="pl-6 text-xs leading-5">
              {t("settings.dataNotice")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[176px_minmax(0,1fr)] md:grid-rows-1">
            <nav
              aria-label={t("settings.title")}
              className="flex gap-1 overflow-x-auto border-b border-dashed bg-background/35 p-2 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-2.5 md:py-3"
            >
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-left text-xs font-medium transition-colors md:w-full",
                      active
                        ? "bg-card text-brand-primary shadow-xs after:absolute after:inset-y-2 after:left-0 after:w-0.5 after:rounded-full after:bg-brand-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Icon className="size-3.5" />
                      {item.id === "ai" && !configured ? (
                        <span
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 size-1.5 rounded-full bg-warning"
                        />
                      ) : null}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-h-0 overflow-y-auto bg-background/20">
              <div className="mx-auto w-full max-w-[680px] p-4 md:p-6">
                {activeSection === "appearance" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={Palette}
                      title={t("settings.appearance")}
                      description={t("settings.appearanceDesc")}
                    />

                    <SettingsCard title={t("settings.theme")}>
                      <div className="grid grid-cols-3 gap-2">
                        {themeOptions.map((option) => {
                          const Icon = option.icon;
                          const selected = themeMode === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setThemeMode(option.id)}
                              className={cn(
                                "relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                                selected
                                  ? "border-brand-primary/55 bg-brand-primary/8 text-brand-primary shadow-[inset_0_0_0_1px_rgb(0_136_255/0.12)]"
                                  : "border-border bg-background/45 text-muted-foreground hover:border-muted-foreground/35 hover:bg-accent hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-8 items-center justify-center rounded-full",
                                  selected ? "bg-brand-primary/12" : "bg-muted",
                                )}
                              >
                                <Icon className="size-4" />
                              </span>
                              {option.label}
                              {selected ? (
                                <Check className="absolute right-2 top-2 size-3 text-brand-primary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </SettingsCard>

                    <SettingsCard title={t("settings.language")}>
                      <div className="grid grid-cols-2 gap-2">
                        {LOCALES.map((item) => (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={locale === item}
                            onClick={() => setLocale(item)}
                            className={cn(
                              "relative flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                              locale === item
                                ? "border-brand-primary/55 bg-brand-primary/8 text-brand-primary"
                                : "border-border bg-background/45 text-muted-foreground hover:border-muted-foreground/35 hover:bg-accent hover:text-foreground",
                            )}
                          >
                            <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                              <Languages className="size-3.5" />
                            </span>
                            {LOCALE_FULL_LABELS[item]}
                            {locale === item ? (
                              <Check className="ml-auto size-3 text-brand-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </SettingsCard>
                  </section>
                ) : null}

                {activeSection === "profile" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={UserRound}
                      title={t("profile.title")}
                      description={t("profile.description")}
                    />

                    <SettingsCard contentClassName="p-0">
                      <div className="flex items-center gap-4 bg-muted/15 p-4">
                        <UserAvatar
                          src={profileDraft.avatar}
                          name={profileDraft.name}
                          className="size-16 border border-border shadow-sm"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="truncate text-sm font-semibold">
                              {profileDraft.name.trim() || defaultProfile.name}
                            </p>
                            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {profileDraft.slogan.trim() || defaultProfile.slogan}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => avatarInputRef.current?.click()}
                            >
                              <Upload />
                              {t("profile.uploadAvatar")}
                            </Button>
                            {profileDraft.avatar !== defaultProfile.avatar ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setProfileDraft((current) => ({
                                    ...current,
                                    avatar: defaultProfile.avatar,
                                  }))
                                }
                              >
                                <RotateCcw />
                                {t("profile.resetAvatar")}
                              </Button>
                            ) : null}
                          </div>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) handleAvatar(file);
                              event.target.value = "";
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 border-t border-dashed border-border p-4">
                        <Field label={t("profile.name")} htmlFor="settings-profile-name">
                          <Input
                            id="settings-profile-name"
                            value={profileDraft.name}
                            maxLength={24}
                            autoComplete="name"
                            onChange={(event) =>
                              setProfileDraft({ ...profileDraft, name: event.target.value })
                            }
                          />
                        </Field>

                        <Field label={t("profile.slogan")} htmlFor="settings-profile-slogan">
                          <Input
                            id="settings-profile-slogan"
                            value={profileDraft.slogan}
                            maxLength={60}
                            onChange={(event) =>
                              setProfileDraft({ ...profileDraft, slogan: event.target.value })
                            }
                          />
                        </Field>
                      </div>

                      <div className="flex justify-end border-t border-dashed border-border bg-muted/10 px-4 py-3">
                        <Button size="sm" onClick={handleProfileSave}>
                          {t("common.save")}
                        </Button>
                      </div>
                    </SettingsCard>
                  </section>
                ) : null}

                {activeSection === "ai" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={Bot}
                      title={t("settings.aiBasic")}
                      description={t("ai.configurePrompt")}
                    />

                    <SettingsCard
                      title={t("settings.aiConnection")}
                      description={t("settings.aiConnectionDesc")}
                      contentClassName="space-y-4"
                    >
                      <Field
                        label={t("ai.baseUrl")}
                        hint={t("ai.baseUrlHint")}
                        htmlFor="ai-base-url"
                      >
                        <Input
                          id="ai-base-url"
                          value={draft.baseUrl}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder={t("ai.baseUrlPlaceholder")}
                          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                        />
                      </Field>

                      <Field label={t("ai.apiKey")} htmlFor="ai-api-key">
                        <div className="flex gap-1.5">
                          <Input
                            id="ai-api-key"
                            type={showKey ? "text" : "password"}
                            value={draft.apiKey}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder={t("ai.apiKeyPlaceholder")}
                            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={showKey ? t("ai.apiKeyHide") : t("ai.apiKeyShow")}
                            onClick={() => setShowKey((value) => !value)}
                          >
                            {showKey ? <EyeOff /> : <Eye />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={t("ai.apiKeyClear")}
                            onClick={() => setDraft({ ...draft, apiKey: "" })}
                          >
                            <X />
                          </Button>
                        </div>
                      </Field>

                      <Field label={t("ai.model")} htmlFor="ai-model">
                        <Input
                          id="ai-model"
                          value={draft.model}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder={t("ai.modelPlaceholder")}
                          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t("ai.temperature")} htmlFor="ai-temperature">
                          <Input
                            id="ai-temperature"
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={draft.temperature}
                            onChange={(event) =>
                              setDraft({ ...draft, temperature: Number(event.target.value) })
                            }
                          />
                        </Field>
                        <Field label={t("ai.maxTokens")} htmlFor="ai-max-tokens">
                          <Input
                            id="ai-max-tokens"
                            type="number"
                            min={64}
                            max={32000}
                            step={64}
                            value={draft.maxTokens}
                            onChange={(event) =>
                              setDraft({ ...draft, maxTokens: Number(event.target.value) })
                            }
                          />
                        </Field>
                      </div>

                      {target ? (
                        <p className="break-all rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
                          {t("ai.requestTarget", { url: target })}
                        </p>
                      ) : null}

                      <div className="flex gap-2 border-t border-dashed border-border pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTest()}
                          disabled={testing}
                        >
                          {testing ? <Loader2 className="animate-spin" /> : <Check />}
                          {testing ? t("ai.testing") : t("ai.test")}
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                          {t("ai.save")}
                        </Button>
                      </div>
                    </SettingsCard>

                    <div className="flex gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                      <div className="space-y-1">
                        <p>{t("ai.privacyNotice")}</p>
                        <p>{t("ai.storageNotice")}</p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeSection === "ai-prompt" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={MessageSquareText}
                      title={t("settings.aiPrompts")}
                      description={t("ai.promptSettingsHint")}
                    />

                    <SettingsCard title={t("ai.promptSettings")} contentClassName="space-y-4">
                      <Tabs
                        value={promptTab}
                        onValueChange={(value) =>
                          setPromptTab(value as "humanize" | "sensitive" | "titles")
                        }
                      >
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="humanize">{t("ai.humanizePrompt")}</TabsTrigger>
                          <TabsTrigger value="sensitive">{t("ai.sensitivePrompt")}</TabsTrigger>
                          <TabsTrigger value="titles">{t("ai.titlesPrompt")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="humanize" className="mt-3 space-y-2">
                          <p className="text-xs leading-5 text-muted-foreground">
                            {t("ai.humanizePromptHint")}
                          </p>
                          <Textarea
                            id="ai-humanize-prompt"
                            aria-label={t("ai.humanizePrompt")}
                            value={draft.prompts.humanize}
                            className="min-h-[420px] resize-y font-mono text-xs leading-5"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                prompts: { ...draft.prompts, humanize: event.target.value },
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                prompts: {
                                  ...draft.prompts,
                                  humanize: getDefaultAiPrompts(locale).humanize,
                                },
                              })
                            }
                          >
                            <RotateCcw />
                            {t("ai.restoreDefaultPrompt")}
                          </Button>
                        </TabsContent>

                        <TabsContent value="sensitive" className="mt-3 space-y-2">
                          <p className="text-xs leading-5 text-muted-foreground">
                            {t("ai.sensitivePromptHint")}
                          </p>
                          <Textarea
                            id="ai-sensitive-prompt"
                            aria-label={t("ai.sensitivePrompt")}
                            value={draft.prompts.sensitive}
                            className="min-h-[420px] resize-y font-mono text-xs leading-5"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                prompts: { ...draft.prompts, sensitive: event.target.value },
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                prompts: {
                                  ...draft.prompts,
                                  sensitive: getDefaultAiPrompts(locale).sensitive,
                                },
                              })
                            }
                          >
                            <RotateCcw />
                            {t("ai.restoreDefaultPrompt")}
                          </Button>
                        </TabsContent>

                        <TabsContent value="titles" className="mt-3 space-y-2">
                          <p className="text-xs leading-5 text-muted-foreground">
                            {t("ai.titlesPromptHint")}
                          </p>
                          <Textarea
                            id="ai-titles-prompt"
                            aria-label={t("ai.titlesPrompt")}
                            value={draft.prompts.titles}
                            className="min-h-[420px] resize-y font-mono text-xs leading-5"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                prompts: { ...draft.prompts, titles: event.target.value },
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                prompts: {
                                  ...draft.prompts,
                                  titles: getDefaultAiPrompts(locale).titles,
                                },
                              })
                            }
                          >
                            <RotateCcw />
                            {t("ai.restoreDefaultPrompt")}
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </SettingsCard>

                    <SettingsCard
                      title={t("ai.selectionPromptSettings")}
                      description={t("ai.selectionPromptSettingsHint")}
                      contentClassName="space-y-4"
                    >
                      <Tabs
                        value={selectionPromptTab}
                        onValueChange={(value) => setSelectionPromptTab(value as AiAction)}
                      >
                        <TabsList className="grid w-full grid-cols-4">
                          {SELECTION_PROMPTS.map((item) => (
                            <TabsTrigger key={item.action} value={item.action}>
                              {t(item.label)}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {SELECTION_PROMPTS.map((item) => (
                          <TabsContent
                            key={item.action}
                            value={item.action}
                            className="mt-3 space-y-2"
                          >
                            <p className="text-xs leading-5 text-muted-foreground">
                              {t(item.hint)}
                            </p>
                            <Textarea
                              id={`ai-${item.action}-prompt`}
                              aria-label={t(item.label)}
                              value={draft.prompts[item.action]}
                              className="min-h-[260px] resize-y font-mono text-xs leading-5"
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  prompts: {
                                    ...draft.prompts,
                                    [item.action]: event.target.value,
                                  },
                                })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  prompts: {
                                    ...draft.prompts,
                                    [item.action]: getDefaultAiPrompts(locale)[item.action],
                                  },
                                })
                              }
                            >
                              <RotateCcw />
                              {t("ai.restoreDefaultPrompt")}
                            </Button>
                          </TabsContent>
                        ))}
                      </Tabs>

                      <div className="flex justify-end border-t border-dashed border-border pt-4">
                        <Button size="sm" onClick={handleSave}>
                          {t("ai.save")}
                        </Button>
                      </div>
                    </SettingsCard>
                  </section>
                ) : null}

                {activeSection === "data" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={Database}
                      title={t("settings.data")}
                      description={t("settings.dataNotice")}
                    />

                    <SettingsCard
                      title={t("settings.dataTransfer")}
                      description={t("settings.dataTransferDesc")}
                      contentClassName="space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="include-key" className="text-xs font-normal leading-5">
                          {t("settings.exportConfigWithKey")}
                        </Label>
                        <Switch
                          id="include-key"
                          checked={includeKey}
                          onCheckedChange={setIncludeKey}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={handleExportConfig}>
                          {t("settings.exportConfig")}
                        </Button>
                        <Button variant="outline" onClick={() => importRef.current?.click()}>
                          <Upload />
                          {t("settings.importConfig")}
                        </Button>
                      </div>
                      <input
                        ref={importRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleImportConfig(file);
                          event.target.value = "";
                        }}
                      />
                    </SettingsCard>

                    <SettingsCard
                      title={t("settings.dangerZone")}
                      description={t("settings.dangerZoneDesc")}
                      className="border-destructive/25"
                      contentClassName="grid gap-2"
                    >
                      {(["draft", "styles", "ai", "all"] as ClearTarget[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          aria-label={t(
                            item === "draft"
                              ? "settings.clearDraft"
                              : item === "styles"
                                ? "settings.clearStyles"
                                : item === "ai"
                                  ? "settings.clearAi"
                                  : "settings.clearAll",
                          )}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                            item === "all"
                              ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                              : "border-border bg-background/35 hover:bg-accent",
                          )}
                          onClick={() => setClearTarget(item)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted",
                              item === "all" && "bg-destructive/10 text-destructive",
                            )}
                          >
                            {item === "all" ? (
                              <AlertTriangle className="size-3.5" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block text-xs font-medium",
                                item === "all" && "text-destructive",
                              )}
                            >
                              {t(
                                item === "draft"
                                  ? "settings.clearDraft"
                                  : item === "styles"
                                    ? "settings.clearStyles"
                                    : item === "ai"
                                      ? "settings.clearAi"
                                      : "settings.clearAll",
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                              {clearDescriptions[item]}
                            </span>
                          </span>
                        </button>
                      ))}
                    </SettingsCard>
                  </section>
                ) : null}

                {activeSection === "about" ? (
                  <section className="space-y-5">
                    <SectionHeader
                      icon={Info}
                      title={t("settings.about")}
                      description={t("settings.aboutDesc")}
                    />

                    <SettingsCard contentClassName="p-0">
                      <div className="flex items-center gap-4 p-4">
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
                          <Image
                            src={fastypeLogo}
                            alt=""
                            aria-hidden="true"
                            width={40}
                            height={40}
                            className="size-10 rounded-lg"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{t("app.name")}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("settings.version", { version: APP_VERSION })}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                            <GitHubIcon />
                            {t("settings.repo")}
                            <ArrowUpRight />
                          </a>
                        </Button>
                      </div>
                    </SettingsCard>

                    <div className="flex gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                      <div>
                        <p className="text-xs font-medium">{t("settings.privacy")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("settings.privacyBody")}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {cropSrc ? (
        <AvatarCropDialog
          src={cropSrc}
          open={Boolean(cropSrc)}
          onOpenChange={(next) => {
            if (!next) closeCrop();
          }}
          onSave={(avatar) => {
            setProfileDraft((current) => ({ ...current, avatar }));
            closeCrop();
          }}
          labels={{
            title: t("profile.cropTitle"),
            description: t("profile.cropDescription"),
            zoomOut: t("profile.zoomOut"),
            zoomIn: t("profile.zoomIn"),
            reset: t("profile.resetCrop"),
            cancel: t("common.cancel"),
            save: t("profile.confirmCrop"),
            saveError: t("profile.cropSaveError"),
          }}
        />
      ) : null}

      {/* 清除数据前展示影响范围并二次确认（PRD FT-SET-002） */}
      <Dialog open={clearTarget !== null} onOpenChange={(next) => !next && setClearTarget(null)}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogHeader>
            <DialogTitle>{t("settings.clearConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {clearTarget ? clearDescriptions[clearTarget] : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={runClear}>
              {t("common.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DEFAULT_AI_CONFIG };
