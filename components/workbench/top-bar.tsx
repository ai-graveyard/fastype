"use client";

import { Download, FilePlus2, Monitor, Moon, Settings, Sun, Upload } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import fastypeLogo from "@/public/fastype-logo.png";
import { useAi } from "@/components/providers/ai-provider";
import { useDocument } from "@/components/providers/document-provider";
import { usePrefs } from "@/components/providers/prefs-provider";
import { GitHubIcon, WechatIcon, XiaohongshuIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { useGlobalShortcuts, useModifierKeyLabel } from "@/hooks/use-global-shortcuts";
import { type TKey } from "@/lib/i18n";
import { ACCEPTED_EXTENSIONS, pickFile, supportsFileSystemAccess } from "@/lib/file";
import { VIEWS, type ViewId } from "@/lib/types";

const VIEW_LABEL_KEYS: Record<ViewId, TKey> = {
  markdown: "view.markdown",
  xhs: "view.xhs",
  wechat: "view.wechat",
};

function ViewLogo({ view }: { view: ViewId }) {
  if (view === "markdown") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path
          d="M6 15V9.5L9 12.5L12 9.5V15M16 9.5V15M13.75 12.75L16 15L18.25 12.75"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (view === "xhs") {
    return <XiaohongshuIcon aria-hidden="true" />;
  }

  return <WechatIcon aria-hidden="true" />;
}

interface TopBarProps {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  onOpenSettings: () => void;
}

export function TopBar({ view, onViewChange, onOpenSettings }: TopBarProps) {
  const { t, themeMode, setThemeMode } = usePrefs();
  const { configured: aiConfigured } = useAi();
  const { filename, setFilename, newDocument, openFile, downloadMarkdown } = useDocument();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = React.useState(false);

  const handleOpen = React.useCallback(async () => {
    // 优先用 File System Access API，拿到 handle 之后才能写回原文件。
    if (supportsFileSystemAccess()) {
      const picked = await pickFile();
      if (picked.ok) {
        await openFile(picked.file, picked.handle);
        return;
      }
    }
    fileInputRef.current?.click();
  }, [openFile]);

  const modKey = useModifierKeyLabel();
  useGlobalShortcuts({
    onSave: downloadMarkdown,
    onOpen: () => void handleOpen(),
  });

  const ThemeIcon = themeMode === "system" ? Monitor : themeMode === "dark" ? Moon : Sun;

  const toggleTheme = () => {
    // system 模式下以当前实际显示为准，确保快捷切换每次都有可见变化。
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    setThemeMode(isCurrentlyDark ? "light" : "dark");
  };

  return (
    <header className="flex h-auto shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card px-3 py-1.5 sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 select-none items-center gap-2.5 pr-1">
          <span className="group flex size-8 items-center justify-center">
            <Image
              src={fastypeLogo}
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="size-8 rounded-md transition-transform duration-[3000ms] ease-out hover:rotate-[360deg] hover:scale-[1.42] motion-reduce:transition-none motion-reduce:hover:rotate-0 motion-reduce:hover:scale-100"
              priority
            />
          </span>
          <span className="hidden text-base font-semibold leading-none tracking-tight sm:inline">
            {t("app.name")}
          </span>
        </div>

        <div className="ml-1 min-w-0">
          {editingName ? (
            // 非受控输入：文件名只在确认时回写，省掉一份需要和外部同步的状态。
            <input
              autoFocus
              defaultValue={filename}
              aria-label={t("doc.filename")}
              onBlur={(event) => {
                setEditingName(false);
                setFilename(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.currentTarget.value = filename;
                  setEditingName(false);
                }
              }}
              className="h-8 w-32 rounded-md border border-input bg-muted/40 px-2 font-mono text-xs sm:w-40"
            />
          ) : (
            <Tooltip label={t("doc.filenameHint")}>
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="block max-w-[6rem] truncate rounded-sm border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground sm:max-w-[12rem]"
              >
                {filename}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip label={t("doc.newDoc")}>
          <Button variant="ghost" size="icon-sm" aria-label={t("doc.newDoc")} onClick={newDocument}>
            <FilePlus2 />
          </Button>
        </Tooltip>
        <Tooltip label={`${t("doc.openDoc")} · ${modKey}O`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("doc.openDoc")}
            onClick={() => void handleOpen()}
          >
            <Upload />
          </Button>
        </Tooltip>
        <Tooltip label={`${t("doc.saveAs")} · ${modKey}S`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("doc.saveAs")}
            onClick={downloadMarkdown}
          >
            <Download />
          </Button>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            // 允许连续打开同一个文件。
            event.target.value = "";
          }}
        />
      </div>

      <div className="order-last flex w-full shrink-0 justify-center sm:order-none sm:mx-auto sm:w-auto">
        {/* 用色块分段样式（而不是下划线），和工作台内部各二级 Tab 区分开，避免两级切换看起来像同一种控件。 */}
        <Tabs value={view} onValueChange={(next) => onViewChange(next as ViewId)}>
          <TabsList className="h-10 gap-0.5 rounded-lg p-0.5" aria-label={t("a11y.viewSwitcher")}>
            {VIEWS.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className="h-full gap-1.5 rounded-md px-2.5 py-0 text-sm [&_svg]:size-4"
              >
                <ViewLogo view={item} />
                {t(VIEW_LABEL_KEYS[item])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* GitHub 与专业版入口在窄屏隐藏，仍可在设置 › 关于中找到 GitHub 链接。 */}
        <Tooltip label="GitHub">
          <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" asChild>
            <a
              href="https://github.com/ai-graveyard/fastype"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
          </Button>
        </Tooltip>

        <Tooltip label={t("a11y.toggleTheme")}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("a11y.toggleTheme")}
            onClick={toggleTheme}
          >
            <ThemeIcon />
          </Button>
        </Tooltip>

        <Tooltip label={aiConfigured ? t("a11y.openSettings") : t("a11y.configureAi")}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={aiConfigured ? t("a11y.openSettings") : t("a11y.configureAi")}
            onClick={onOpenSettings}
          >
            <Settings />
            {!aiConfigured ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-0.5 top-0.5 flex size-2 items-center justify-center rounded-full bg-warning ring-2 ring-card"
              />
            ) : null}
          </Button>
        </Tooltip>

        <Button
          variant="outline"
          size="sm"
          className="ml-1 hidden border-brand-primary/40 text-brand-primary hover:border-brand-primary/60 hover:bg-brand-primary/10 hover:text-brand-primary sm:inline-flex"
          asChild
        >
          <a href="https://lovtype.com" target="_blank" rel="noopener noreferrer">
            {t("app.useProfessional")}
          </a>
        </Button>
      </div>
    </header>
  );
}
