"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Download,
  Ellipsis,
  ListTree,
  Monitor,
  RotateCcw,
  Smartphone,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PhoneFrame,
  PhoneStatusBar,
  usePhoneFitScale,
} from "@/components/ui/phone-frame";
import { ProfileButton } from "@/components/workbench/profile-button";
import { useImageFallback } from "@/hooks/use-image-status";
import type { WechatStyle } from "@/lib/themes/wechat";
import { cn } from "@/lib/utils";

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const SCROLL_EDGE_THRESHOLD = 4;

type ScrollPosition = "top" | "middle" | "bottom" | "static";

interface WechatOutlineItem {
  label: string;
  level: 1 | 2 | 3;
  targetIndex: number;
}

export type WechatWorkspaceTab = "content" | "cover" | "theme" | "typography" | "enhance";
export interface WechatSettingsTarget {
  tab: Exclude<WechatWorkspaceTab, "content">;
  sectionId: string;
}

interface WechatPreviewProps {
  html: string;
  style: WechatStyle;
  onStyleChange: (patch: Partial<WechatStyle>) => void;
  onNavigateSettings: (target: WechatSettingsTarget) => void;
  onCopy: () => void;
  onDownloadHtml: () => void;
  onCopyPlain: () => void;
  copyDisabled: boolean;
  plainTextCopyDisabled: boolean;
  onImageFailuresChange?: (sources: string[]) => void;
  onEditProfile?: () => void;
}

function settingsTarget(target: HTMLElement): WechatSettingsTarget | null {
  if (target.closest('[data-wechat-card="identity"]')) {
    return { tab: "enhance", sectionId: "wechat-identity-card" };
  }
  if (target.closest('[data-wechat-card="tail-guide"]')) {
    return { tab: "enhance", sectionId: "wechat-tail-guide" };
  }
  if (target.closest("h1, h2, h3, h4, h5, h6")) {
    return { tab: "typography", sectionId: "wechat-heading-system" };
  }
  if (target.closest("blockquote")) {
    return { tab: "typography", sectionId: "wechat-quote-settings" };
  }
  if (target.closest("pre, code")) {
    return { tab: "typography", sectionId: "wechat-code-settings" };
  }
  if (target.closest("ul, ol, li")) {
    return { tab: "typography", sectionId: "wechat-list-settings" };
  }
  if (target.closest("strong, b, em, i, del, s, a")) {
    return { tab: "typography", sectionId: "wechat-text-elements" };
  }
  if (target.closest("p")) {
    return { tab: "typography", sectionId: "wechat-body-typography" };
  }
  if (target.closest("section")) {
    return { tab: "theme", sectionId: "wechat-page-layout" };
  }
  return null;
}

const PREVIEW_HOVER_STYLES = `
[data-wechat-preview-root] h1:hover,
[data-wechat-preview-root] h2:hover,
[data-wechat-preview-root] h3:hover,
[data-wechat-preview-root] h4:hover,
[data-wechat-preview-root] h5:hover,
[data-wechat-preview-root] h6:hover,
[data-wechat-preview-root] p:hover,
[data-wechat-preview-root] strong:hover,
[data-wechat-preview-root] b:hover,
[data-wechat-preview-root] em:hover,
[data-wechat-preview-root] i:hover,
[data-wechat-preview-root] del:hover,
[data-wechat-preview-root] s:hover,
[data-wechat-preview-root] a:hover,
[data-wechat-preview-root] blockquote:hover,
[data-wechat-preview-root] pre:hover,
[data-wechat-preview-root] code:hover,
[data-wechat-preview-root] ul:hover,
[data-wechat-preview-root] ol:hover,
[data-wechat-preview-root] li:hover,
[data-wechat-preview-root] [data-wechat-card]:hover {
  outline: 2px dashed rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
  cursor: pointer;
  border-radius: 4px;
}
`;

export const WechatPreview = React.memo(function WechatPreview({
  html,
  style,
  onStyleChange,
  onNavigateSettings,
  onCopy,
  onDownloadHtml,
  onCopyPlain,
  copyDisabled,
  plainTextCopyDisabled,
  onImageFailuresChange,
  onEditProfile,
}: WechatPreviewProps) {
  const t = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = React.useState(1);
  const [scrollPosition, setScrollPosition] = React.useState<ScrollPosition>("static");
  const [outlineItems, setOutlineItems] = React.useState<WechatOutlineItem[]>([]);
  const fittedPhoneScale = usePhoneFitScale(containerRef, previewZoom);
  const failedImages = useImageFallback(contentRef, t("image.failed"), [
    html,
    style.showPhoneFrame,
  ]);
  React.useEffect(() => {
    onImageFailuresChange?.(failedImages);
  }, [failedImages, onImageFailuresChange]);

  const updateScrollPosition = React.useCallback((viewport: HTMLDivElement) => {
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    if (maxScrollTop <= SCROLL_EDGE_THRESHOLD) {
      setScrollPosition("static");
    } else if (viewport.scrollTop <= SCROLL_EDGE_THRESHOLD) {
      setScrollPosition("top");
    } else if (viewport.scrollTop >= maxScrollTop - SCROLL_EDGE_THRESHOLD) {
      setScrollPosition("bottom");
    } else {
      setScrollPosition("middle");
    }
  }, []);

  React.useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => updateScrollPosition(viewport));
    return () => window.cancelAnimationFrame(frame);
  }, [html, previewZoom, style.showPhoneFrame, updateScrollPosition]);

  React.useEffect(() => {
    const root = contentRef.current;
    if (!root) {
      setOutlineItems([]);
      return;
    }

    const items = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3"))
      .map((heading, targetIndex): WechatOutlineItem | null => {
        const labelNode = heading.cloneNode(true) as HTMLElement;
        labelNode.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
        const label = labelNode.textContent?.replace(/\s+/g, " ").trim();
        if (!label) return null;
        return {
          label,
          level: Number(heading.tagName.slice(1)) as 1 | 2 | 3,
          targetIndex,
        };
      })
      .filter((item): item is WechatOutlineItem => item !== null);
    setOutlineItems(items);
  }, [html, style.showPhoneFrame]);

  const scrollPreview = React.useCallback((edge: "top" | "bottom") => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: edge === "top" ? 0 : viewport.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const scrollToHeading = React.useCallback((targetIndex: number) => {
    const heading = contentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3")[
      targetIndex
    ];
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePreviewClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = settingsTarget(event.target as HTMLElement);
      if (!target) return;
      event.preventDefault();
      onNavigateSettings(target);
    },
    [onNavigateSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_HOVER_STYLES }} />
      <div className="grid h-[53px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-dashed bg-background/30 px-5">
        <div className="flex min-w-0 items-center">
          <div className="flex h-8 items-center rounded-md border bg-muted/45 p-0.5">
            <button
              type="button"
              onClick={() => onStyleChange({ showPhoneFrame: true })}
              className={`inline-flex h-7 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-medium transition-all ${
                style.showPhoneFrame
                  ? "bg-card text-brand-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={t("wechat.phonePreview")}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>手机</span>
            </button>
            <button
              type="button"
              onClick={() => onStyleChange({ showPhoneFrame: false })}
              className={`inline-flex h-7 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-medium transition-all ${
                !style.showPhoneFrame
                  ? "bg-card text-brand-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={t("wechat.widePreview")}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>电脑</span>
            </button>
          </div>
        </div>
        <ProfileButton onClick={onEditProfile} />
        <div className="flex items-center justify-self-end gap-1.5">
          <Button
            size="sm"
            className="border border-brand-primary/30 bg-brand-primary/10 text-brand-primary shadow-none hover:bg-brand-primary/15"
            disabled={copyDisabled}
            onClick={onCopy}
          >
            <Copy />
            {t("common.copy")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={copyDisabled}
                aria-label={t("common.more")}
                title={t("common.more")}
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onDownloadHtml}>
                <Download />
                {t("wechat.downloadHtml")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={plainTextCopyDisabled} onSelect={onCopyPlain}>
                <Type />
                {t("wechat.copyPlain")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={containerRef}
        data-testid="wechat-preview-stage"
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 pt-4 pb-12"
      >
        {style.showPhoneFrame ? (
          <PhoneFrame scale={fittedPhoneScale} screenClassName="flex flex-col">
            <PhoneStatusBar
              backgroundColor={style.pageBackground}
              foregroundColor={style.textColor}
            />
            <div
              ref={scrollViewportRef}
              data-testid="wechat-preview-scroll"
              className="min-h-0 flex-1 overflow-y-auto"
              onClick={handlePreviewClick}
              onScroll={(event) => updateScrollPosition(event.currentTarget)}
            >
              <div
                ref={contentRef}
                data-wechat-preview-root
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </PhoneFrame>
        ) : (
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.4rem] bg-[#d4d4d4] p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5">
            <div className="flex h-9 shrink-0 items-center gap-3 rounded-t-[1rem] bg-[#ececec] px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="h-5 flex-1 rounded-full bg-white/75 ring-1 ring-black/5" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-b-[1rem] bg-white">
              <div
                ref={scrollViewportRef}
                data-testid="wechat-preview-scroll"
                className="h-full overflow-y-auto"
                style={{
                  transform: `scale(${previewZoom})`,
                  transformOrigin: "top left",
                  width: `${100 / previewZoom}%`,
                  height: `${100 / previewZoom}%`,
                }}
                onClick={handlePreviewClick}
                onScroll={(event) => updateScrollPosition(event.currentTarget)}
              >
                <div
                  ref={contentRef}
                  data-wechat-preview-root
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          </div>
        )}

        {outlineItems.length >= 2 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 z-10 h-7 w-7 rounded-full bg-background/25 text-muted-foreground/55 opacity-50 backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border data-[state=open]:bg-background/75 data-[state=open]:text-foreground data-[state=open]:opacity-100"
                aria-label={t("wechat.outline")}
                title={t("wechat.outline")}
              >
                <ListTree className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="max-h-72 w-64 overflow-y-auto"
            >
              <DropdownMenuLabel>{t("wechat.outline")}</DropdownMenuLabel>
              {outlineItems.map((item) => (
                <DropdownMenuItem
                  key={`${item.targetIndex}-${item.label}`}
                  className={cn(
                    "min-w-0 text-xs",
                    item.level === 2 && "pl-5",
                    item.level === 3 && "pl-8 text-muted-foreground",
                  )}
                  onSelect={() => scrollToHeading(item.targetIndex)}
                >
                  <span className="truncate">{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-2 right-2 z-10 h-7 w-7 rounded-full backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border",
            scrollPosition === "bottom"
              ? "bg-background/65 text-foreground/85 opacity-100 ring-1 ring-border/60"
              : "bg-background/25 text-muted-foreground/55 opacity-50",
          )}
          onClick={() => scrollPreview("top")}
          aria-label={t("wechat.scrollToTop")}
          title={t("wechat.scrollToTop")}
        >
          <ArrowUpToLine className="h-3.5 w-3.5" />
        </Button>

        <div className="absolute bottom-2 left-2 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPreviewZoom(Math.max(previewZoom - ZOOM_STEP, ZOOM_MIN))}
            disabled={previewZoom <= ZOOM_MIN}
            title={t("wechat.zoomOut")}
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="w-9 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(previewZoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPreviewZoom(Math.min(previewZoom + ZOOM_STEP, ZOOM_MAX))}
            disabled={previewZoom >= ZOOM_MAX}
            title={t("wechat.zoomIn")}
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPreviewZoom(1)}
            disabled={previewZoom === 1}
            title={t("wechat.zoomReset")}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-2 bottom-2 z-10 h-7 w-7 rounded-full backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border",
            scrollPosition === "top"
              ? "bg-background/65 text-foreground/85 opacity-100 ring-1 ring-border/60"
              : "bg-background/25 text-muted-foreground/55 opacity-50",
          )}
          onClick={() => scrollPreview("bottom")}
          aria-label={t("wechat.scrollToBottom")}
          title={t("wechat.scrollToBottom")}
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
