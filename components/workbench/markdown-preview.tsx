"use client";

import { Eye, ImageDown, Loader2 } from "lucide-react";
import * as React from "react";

import { usePrefs } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useImageFallback } from "@/hooks/use-image-status";
import { MARKDOWN_PREVIEW_THEMES } from "@/lib/themes/markdown";
import { cn } from "@/lib/utils";

const THEME_LABEL_KEYS = {
  github: "editor.themeGitHub",
  notion: "editor.themeNotion",
  paper: "editor.themePaper",
  night: "editor.themeNight",
} as const;

export interface MarkdownPreviewHandle {
  getExportNode: () => HTMLDivElement | null;
}

interface MarkdownPreviewProps {
  html: string;
  exporting: boolean;
  onExport: () => void;
}

/** Markdown 视图左侧的通用渲染预览（PRD FT-EDT-004）。 */
export const MarkdownPreview = React.memo(React.forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview({ html, exporting, onExport }, ref) {
    const { t, markdownPreviewTheme, setMarkdownPreviewTheme } = usePrefs();
    const containerRef = React.useRef<HTMLDivElement>(null);
    useImageFallback(containerRef, t("image.failed"), [html]);
    React.useImperativeHandle(ref, () => ({ getExportNode: () => containerRef.current }), []);

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
              {MARKDOWN_PREVIEW_THEMES.map((theme) => (
                <ThemeButton
                  key={theme}
                  active={markdownPreviewTheme === theme}
                  label={t(THEME_LABEL_KEYS[theme])}
                  onClick={() => setMarkdownPreviewTheme(theme)}
                />
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2"
            disabled={!html || exporting}
            onClick={onExport}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <ImageDown />}
            {exporting ? t("editor.exportingLongImage") : t("editor.downloadLongImage")}
          </Button>
        </div>

        {!html ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {t("editor.placeholder")}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              ref={containerRef}
              className={cn(
                "md-preview mx-auto max-w-3xl px-8 py-8 text-[15px]",
                `md-theme-${markdownPreviewTheme}`,
              )}
              // html 已在 lib/markdown/parse.ts 里经 DOMPurify 消毒（PRD 10.2）。
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    );
  },
));

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
