"use client";

import {
  ChevronDown,
  ClipboardCheck,
  Code2,
  Download,
  Eye,
  FileDown,
  ImageDown,
  Loader2,
} from "lucide-react";
import * as React from "react";

import { usePrefs } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useImageFallback } from "@/hooks/use-image-status";
import {
  MARKDOWN_PREVIEW_MORE_THEMES,
  MARKDOWN_PREVIEW_QUICK_THEMES,
  MARKDOWN_PREVIEW_THEME_LABEL_KEYS,
  isMarkdownPreviewTheme,
} from "@/lib/themes/markdown";
import { cn } from "@/lib/utils";

export interface MarkdownPreviewHandle {
  getExportNode: () => HTMLDivElement | null;
  /** 滚动容器，供与编辑器的滚动同步使用。 */
  getScrollNode: () => HTMLDivElement | null;
}

interface MarkdownPreviewProps {
  html: string;
  exporting: boolean;
  onExport: () => void;
  /** 复制带内联样式的正文，粘到公众号 / 飞书 / Word 都保留排版。 */
  onCopyStyled: () => void;
  onExportHtml: () => void;
  onPrint: () => void;
}

/** Markdown 视图左侧的通用渲染预览（PRD FT-EDT-004）。 */
export const MarkdownPreview = React.memo(
  React.forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(function MarkdownPreview(
    { html, exporting, onExport, onCopyStyled, onExportHtml, onPrint },
    ref,
  ) {
    const { t, markdownPreviewTheme, setMarkdownPreviewTheme } = usePrefs();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    // 正文没变时必须是同一个对象：导出会切换 exporting 状态，每次重渲染都新建
    // 一份 { __html } 会让 React 重设整段 innerHTML——预览里的图片跟着重新请求，
    // 滚动同步缓存的块也会全部失联。
    const previewHtml = React.useMemo(() => ({ __html: html }), [html]);
    useImageFallback(containerRef, t("image.failed"), [html]);
    React.useImperativeHandle(
      ref,
      () => ({
        getExportNode: () => containerRef.current,
        getScrollNode: () => scrollRef.current,
      }),
      [],
    );

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-[53px] shrink-0 items-center gap-3 border-b border-dashed border-border bg-background/30 px-4">
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{t("view.preview")}</span>
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="mx-auto flex h-8 w-max items-center rounded-md border border-border bg-muted/45 p-0.5"
              role="group"
              aria-label={t("editor.previewThemes")}
            >
              {MARKDOWN_PREVIEW_QUICK_THEMES.map((theme) => (
                <ThemeButton
                  key={theme}
                  active={markdownPreviewTheme === theme}
                  label={t(MARKDOWN_PREVIEW_THEME_LABEL_KEYS[theme])}
                  onClick={() => setMarkdownPreviewTheme(theme)}
                />
              ))}
              <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
              <MoreThemesMenu />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip label={t("editor.copyStyledLabel")}>
              <Button
                size="sm"
                // 与公众号预览的「复制」保持同一套主题色描边样式和尺寸。
                className="border border-brand-primary/30 bg-brand-primary/10 text-brand-primary shadow-none hover:bg-brand-primary/15"
                disabled={!html}
                onClick={onCopyStyled}
              >
                <ClipboardCheck />
                {t("editor.copyStyled")}
              </Button>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("editor.exportMenuLabel")}
                  disabled={!html || exporting}
                >
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                  {exporting ? t("editor.exportingLongImage") : t("editor.exportMenu")}
                  <ChevronDown className="size-3" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onExport}>
                  <ImageDown />
                  {t("editor.downloadLongImage")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onExportHtml}>
                  <Code2 />
                  {t("editor.exportHtml")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onPrint}>
                  <FileDown />
                  {t("editor.printPreview")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!html ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {t("editor.placeholder")}
          </div>
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div
              ref={containerRef}
              className={cn(
                "md-preview mx-auto max-w-3xl px-8 py-8 text-[15px]",
                `md-theme-${markdownPreviewTheme}`,
              )}
              // html 已在 lib/markdown/parse.ts 里经 DOMPurify 消毒（PRD 10.2）。
              dangerouslySetInnerHTML={previewHtml}
            />
          </div>
        )}
      </div>
    );
  }),
);

/** 常用主题之外的主题收在这里，工具栏只留三个快捷位。 */
function MoreThemesMenu() {
  const { t, markdownPreviewTheme, setMarkdownPreviewTheme } = usePrefs();
  const active = (MARKDOWN_PREVIEW_MORE_THEMES as readonly string[]).includes(markdownPreviewTheme);
  const label = active
    ? t(MARKDOWN_PREVIEW_THEME_LABEL_KEYS[markdownPreviewTheme])
    : t("editor.moreThemes");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("editor.moreThemesLabel")}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-transparent px-2 text-[11px] font-medium transition-all",
            active
              ? "bg-card text-brand-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuRadioGroup
          value={markdownPreviewTheme}
          onValueChange={(value) => {
            if (isMarkdownPreviewTheme(value)) setMarkdownPreviewTheme(value);
          }}
        >
          {MARKDOWN_PREVIEW_MORE_THEMES.map((theme) => (
            <DropdownMenuRadioItem key={theme} value={theme}>
              {t(MARKDOWN_PREVIEW_THEME_LABEL_KEYS[theme])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "inline-flex h-7 items-center rounded-sm border border-transparent px-2 text-[11px] font-medium transition-all",
          active
            ? "bg-card text-brand-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}
