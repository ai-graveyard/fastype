"use client";

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  CornerUpRight,
  Ellipsis,
  FileText,
  Heart,
  ImageDown,
  LayoutGrid,
  Loader2,
  MessageCircle,
  RotateCcw,
  Search,
  Star,
  TableOfContents,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PHONE_WIDTH,
  PhoneFrame,
  PhoneStatusBar,
  usePhoneFitScale,
} from "@/components/ui/phone-frame";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ProfileButton } from "@/components/workbench/profile-button";
import { CoverGraphicsLayer } from "@/components/workbench/xhs-cover-graphics";
import {
  XHS_IDENTIFIER_CONTENT_GAP,
  XhsIdentifier,
  xhsIdentifierHeight,
} from "@/components/workbench/xhs-identifier";
import {
  hasRenderableXhsQrCode,
  XHS_QR_CODE_CONTENT_GAP,
  XhsQrCode,
  xhsQrCodeHeight,
} from "@/components/workbench/xhs-qr-code";
import { useImageFallback, useImagesSettled } from "@/hooks/use-image-status";
import { paginate, type Page } from "@/lib/markdown/paginate";
import type { XhsMetadata } from "@/lib/markdown/xhs-frontmatter";
import {
  applyListStart,
  cloneForPage,
  measureBlocks,
  prepareForMeasure,
  type MeasureResult,
} from "@/lib/render/xhs-layout";
import {
  applyXhsBodyTitleOverride,
  applyXhsHeadingNumbers,
  contentWidth,
  XHS_CARD_CLASS,
  xhsCardCss,
  xhsFooterBlockHeight,
  xhsPalette,
} from "@/lib/render/xhs";
import {
  getXhsCanvasSize,
  type XhsStyle,
} from "@/lib/themes/xhs";
import { cn } from "@/lib/utils";

export interface XhsPreviewHandle {
  /** 导出用的原始尺寸节点，和手机预览中的卡片来自同一棵 DOM。 */
  getPageNodes: () => HTMLElement[];
}

interface XhsPreviewProps {
  html: string;
  /** 正文中明确存在的一级标题，仅供封面文字留空时使用。 */
  documentTitle: string;
  hasTitle: boolean;
  /** 发布到小红书笔记正文区域的标题、正文和标签。 */
  metadata: XhsMetadata;
  style: XhsStyle;
  onPagesChange: (info: { total: number; overflowPages: number[] }) => void;
  onExport: () => void;
  onExportPage: (pageIndex: number) => void;
  exportDisabled: boolean;
  exporting: boolean;
  onImageFailuresChange?: (sources: string[]) => void;
  onEditProfile?: () => void;
}

type PreviewMode = "full" | "home";

const PHONE_SCREEN_WIDTH = PHONE_WIDTH - 24;
const FULL_CARD_WIDTH = PHONE_SCREEN_WIDTH;
const HOME_CARD_WIDTH = (PHONE_SCREEN_WIDTH - 24) / 2;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const SWIPE_DISTANCE_RATIO = 0.25;
const SWIPE_VELOCITY_THRESHOLD = 300;
const SWIPE_EDGE_RESISTANCE = 0.2;
const SWIPE_TRANSITION_MS = 260;
/** 封面标题留更宽的排版空间；标识、二维码和页脚仍复用正文卡片布局规则。 */
const COVER_TITLE_PADDING = 48;

/**
 * 手机场景里的卡片始终从导出节点 clone，避免再维护一套“看起来差不多”的预览样式。
 * clone 只承担显示；导出仍截取 pageRefs 中未缩放的 1080×1440 原始节点。
 */
function XhsCardClone({
  pageRefs,
  pageIndex,
  displayWidth,
  sourceWidth,
  sourceHeight,
  refreshKey,
  className,
}: {
  pageRefs: React.RefObject<(HTMLDivElement | null)[]>;
  pageIndex: number;
  displayWidth: number;
  sourceWidth: number;
  sourceHeight: number;
  refreshKey: string;
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    const source = pageRefs.current[pageIndex];
    if (!host) return;
    const syncClone = () => {
      host.replaceChildren();
      if (!source) return;
      const clone = source.cloneNode(true) as HTMLDivElement;
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.style.pointerEvents = "none";
      clone.style.transform = `scale(${displayWidth / sourceWidth})`;
      clone.style.transformOrigin = "top left";
      host.appendChild(clone);
    };
    syncClone();
    if (!source) return;
    const observer = new MutationObserver(syncClone);
    observer.observe(source, { attributes: true, childList: true, subtree: true });

    return () => {
      observer.disconnect();
      host.replaceChildren();
    };
  }, [displayWidth, pageIndex, pageRefs, refreshKey, sourceWidth]);

  return (
    <div
      ref={hostRef}
      className={cn("overflow-hidden bg-muted", className)}
      style={{ width: displayWidth, height: displayWidth * (sourceHeight / sourceWidth) }}
    />
  );
}

interface SwipePointerState {
  pointerId: number;
  startX: number;
  lastX: number;
  lastAt: number;
  rawOffset: number;
  velocity: number;
}

/**
 * 小红书详情页图片轮播。
 *
 * 对齐 LovType：当前页和相邻页跟手移动，超过四分之一宽度或快速甩动时翻页；
 * 首尾继续拖动时增加阻尼，松手后回弹。
 */
function XhsSwipeCarousel({
  pageRefs,
  activePage,
  totalPages,
  sourceWidth,
  sourceHeight,
  refreshKey,
  emptyMessage,
  dragLabel,
  previousLabel,
  nextLabel,
  onPageChange,
}: {
  pageRefs: React.RefObject<(HTMLDivElement | null)[]>;
  activePage: number;
  totalPages: number;
  sourceWidth: number;
  sourceHeight: number;
  refreshKey: string;
  emptyMessage: string;
  dragLabel: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}) {
  const pointerRef = React.useRef<SwipePointerState | null>(null);
  const transitionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = React.useRef(0);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [transitioning, setTransitioning] = React.useState(false);

  const setOffset = React.useCallback((offset: number) => {
    offsetRef.current = offset;
    setDragOffset(offset);
  }, []);

  const clearTransitionTimer = React.useCallback(() => {
    if (!transitionTimerRef.current) return;
    clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
  }, []);

  const settle = React.useCallback(
    (targetPage: number | null) => {
      clearTransitionTimer();
      setTransitioning(true);

      if (targetPage === null) {
        setOffset(0);
      } else {
        setOffset(targetPage > activePage ? -FULL_CARD_WIDTH : FULL_CARD_WIDTH);
      }

      transitionTimerRef.current = setTimeout(() => {
        if (targetPage !== null) onPageChange(targetPage);
        setTransitioning(false);
        setOffset(0);
        transitionTimerRef.current = null;
      }, SWIPE_TRANSITION_MS);
    },
    [activePage, clearTransitionTimer, onPageChange, setOffset],
  );

  const finishPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;

      pointerRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (cancelled) {
        settle(null);
        return;
      }

      const crossedDistance =
        Math.abs(pointer.rawOffset) >= FULL_CARD_WIDTH * SWIPE_DISTANCE_RATIO;
      const crossedVelocity = Math.abs(pointer.velocity) >= SWIPE_VELOCITY_THRESHOLD;
      const wantsNext =
        pointer.rawOffset < 0 &&
        (crossedDistance || pointer.velocity < -SWIPE_VELOCITY_THRESHOLD);
      const wantsPrevious =
        pointer.rawOffset > 0 &&
        (crossedDistance || pointer.velocity > SWIPE_VELOCITY_THRESHOLD);

      if ((crossedDistance || crossedVelocity) && wantsNext && activePage < totalPages - 1) {
        settle(activePage + 1);
      } else if ((crossedDistance || crossedVelocity) && wantsPrevious && activePage > 0) {
        settle(activePage - 1);
      } else {
        settle(null);
      }
    },
    [activePage, settle, totalPages],
  );

  React.useEffect(
    () => () => {
      clearTransitionTimer();
    },
    [clearTransitionTimer],
  );

  return (
    <div
      className="group relative shrink-0 select-none overflow-hidden bg-black/5"
      aria-label={dragLabel}
      data-testid="xhs-swipe-carousel"
    >
      {totalPages > 0 ? (
        <div
          className={cn(
            "relative flex w-full cursor-grab active:cursor-grabbing",
            dragging && "cursor-grabbing",
          )}
          data-testid="xhs-swipe-track"
          style={{
            touchAction: "pan-y",
            transform: `translate3d(${dragOffset}px, 0, 0)`,
            transition: transitioning
              ? `transform ${SWIPE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
            willChange: totalPages > 1 ? "transform" : undefined,
          }}
          onPointerDown={(event) => {
            if (totalPages <= 1 || event.button !== 0 || transitioning) return;
            clearTransitionTimer();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            pointerRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              lastX: event.clientX,
              lastAt: performance.now(),
              rawOffset: 0,
              velocity: 0,
            };
            setDragging(true);
            setOffset(0);
          }}
          onPointerMove={(event) => {
            const pointer = pointerRef.current;
            if (!pointer || pointer.pointerId !== event.pointerId) return;

            const now = performance.now();
            const elapsed = Math.max(now - pointer.lastAt, 1);
            const rawOffset = event.clientX - pointer.startX;
            pointer.velocity = ((event.clientX - pointer.lastX) / elapsed) * 1000;
            pointer.lastX = event.clientX;
            pointer.lastAt = now;
            pointer.rawOffset = rawOffset;

            const atStart = activePage === 0 && rawOffset > 0;
            const atEnd = activePage === totalPages - 1 && rawOffset < 0;
            setOffset(atStart || atEnd ? rawOffset * SWIPE_EDGE_RESISTANCE : rawOffset);
            if (Math.abs(rawOffset) > 3) event.preventDefault();
          }}
          onPointerUp={(event) => finishPointer(event)}
          onPointerCancel={(event) => finishPointer(event, true)}
          onLostPointerCapture={(event) => finishPointer(event, true)}
        >
          {activePage > 0 ? (
            <div className="absolute right-full top-0 h-full shrink-0">
              <XhsCardClone
                pageRefs={pageRefs}
                pageIndex={activePage - 1}
                displayWidth={FULL_CARD_WIDTH}
                sourceWidth={sourceWidth}
                sourceHeight={sourceHeight}
                refreshKey={refreshKey}
              />
            </div>
          ) : null}

          <XhsCardClone
            pageRefs={pageRefs}
            pageIndex={activePage}
            displayWidth={FULL_CARD_WIDTH}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
            refreshKey={refreshKey}
          />

          {activePage < totalPages - 1 ? (
            <div className="absolute left-full top-0 h-full shrink-0">
              <XhsCardClone
                pageRefs={pageRefs}
                pageIndex={activePage + 1}
                displayWidth={FULL_CARD_WIDTH}
                sourceWidth={sourceWidth}
                sourceHeight={sourceHeight}
                refreshKey={refreshKey}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="flex items-center justify-center px-10 text-center text-sm text-zinc-400"
          style={{
            width: FULL_CARD_WIDTH,
            height: FULL_CARD_WIDTH * (sourceHeight / sourceWidth),
          }}
        >
          {emptyMessage}
        </div>
      )}

      {totalPages > 1 ? (
        <>
          <button
            type="button"
            aria-label={previousLabel}
            disabled={activePage <= 0 || transitioning}
            onClick={() => onPageChange(activePage - 1)}
            className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-0"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            disabled={activePage >= totalPages - 1 || transitioning}
            onClick={() => onPageChange(activePage + 1)}
            className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-0"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      ) : null}

      {totalPages > 0 ? (
        <span className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          {activePage + 1}/{totalPages}
        </span>
      ) : null}
    </div>
  );
}

function FeedPlaceholder({ height }: { height: number }) {
  return (
    <div className="overflow-hidden rounded-md bg-white">
      <div className="relative overflow-hidden bg-[#ececec]" style={{ height }}>
        <div className="absolute inset-0 scale-110 bg-[radial-gradient(circle_at_28%_20%,rgba(255,90,120,0.26),transparent_34%),radial-gradient(circle_at_72%_62%,rgba(90,150,255,0.20),transparent_36%),linear-gradient(135deg,rgba(0,0,0,0.03),rgba(0,0,0,0.12))] blur-md" />
      </div>
      <div className="space-y-2 p-2">
        <div className="h-2.5 w-4/5 rounded-full bg-[#ececec]" />
        <div className="h-2.5 w-3/5 rounded-full bg-[#ececec]" />
      </div>
    </div>
  );
}

export const XhsPreview = React.memo(React.forwardRef<XhsPreviewHandle, XhsPreviewProps>(
  function XhsPreview(
    {
      html,
      documentTitle,
      hasTitle,
      metadata,
      style,
      onPagesChange,
      onExport,
      onExportPage,
      exportDisabled,
      exporting,
      onImageFailuresChange,
      onEditProfile,
    },
    ref,
  ) {
    const t = useT();
    const { profile } = useUserProfile();
    const measureRef = React.useRef<HTMLDivElement>(null);
    const previewStageRef = React.useRef<HTMLDivElement>(null);
    const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const bodyRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const layoutRef = React.useRef<MeasureResult | null>(null);
    const [pages, setPages] = React.useState<Page[]>([]);
    const [selectedPage, setSelectedPage] = React.useState(0);
    const [previewMode, setPreviewMode] = React.useState<PreviewMode>("full");
    const [previewZoom, setPreviewZoom] = React.useState(1);
    const [layoutTick, setLayoutTick] = React.useState(0);
    const phoneScale = usePhoneFitScale(previewStageRef, previewZoom);

    const css = React.useMemo(() => xhsCardCss(style), [style]);
    const palette = React.useMemo(() => xhsPalette(style), [style]);
    const canvas = React.useMemo(() => getXhsCanvasSize(style), [style]);
    const innerWidth = contentWidth(style);
    const coverOffset = style.cover.enabled ? 1 : 0;
    const pageNumberOffset =
      style.cover.enabled && style.showPageNumberOnCover ? 1 : 0;
    const identifierAtTop = style.identifier.position.startsWith("top");
    const identifierGap = XHS_IDENTIFIER_CONTENT_GAP * style.identifier.scale;
    const identifierReservedHeight = style.identifier.enabled
      ? xhsIdentifierHeight(style.identifier) + identifierGap
      : 0;
    const qrCodeAtTop = style.qrCode.position.startsWith("top");
    const qrCodeGap = XHS_QR_CODE_CONTENT_GAP * style.qrCode.scale;
    const qrCodeReservedHeight = hasRenderableXhsQrCode(style.qrCode)
      ? xhsQrCodeHeight(style.qrCode) + qrCodeGap
      : 0;
    const footerReservedHeight = xhsFooterBlockHeight(style);

    // 只渲染正文中明确存在的标题，不再用文件名补标题；样式里的自定义标题优先于 Markdown 的 H1。
    const bodyTitleOverride = style.bodyTitleOverride.trim();
    const contentHtml = React.useMemo(() => {
      if (!html) return "";
      const withOverride = bodyTitleOverride
        ? applyXhsBodyTitleOverride(html, bodyTitleOverride)
        : html;
      const withoutCoverTitle =
        (hasTitle || bodyTitleOverride) && style.cover.enabled && style.cover.hideBodyTitle
          ? withOverride.replace(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/i, "")
          : withOverride;
      return applyXhsHeadingNumbers(withoutCoverTitle, style);
    }, [html, hasTitle, style, bodyTitleOverride]);

    const failedImages = useImageFallback(measureRef, t("image.failed"), [contentHtml]);
    React.useEffect(() => {
      onImageFailuresChange?.(failedImages);
    }, [failedImages, onImageFailuresChange]);
    const imagesTick = useImagesSettled(measureRef, contentHtml);

    // 测量 + 分页。图片高度要等图片 settle 之后才准，所以 imagesTick 也是依赖。
    /*
     * 分页结果必须来自浏览器真实布局，因而这里是“读取 DOM 尺寸 -> 同步 React 分页状态”。
     * 这不是可由 render 推导的状态，局部豁免 React 19 的通用 effect 提示。
     */
    /* eslint-disable react-hooks/set-state-in-effect */
    React.useLayoutEffect(() => {
      const container = measureRef.current;
      if (!container) return;
      if (!contentHtml) {
        const next = paginate([], canvas.height);
        container.innerHTML = "";
        layoutRef.current = null;
        setPages(next);
        setLayoutTick((value) => value + 1);
        onPagesChange({ total: next.length + coverOffset, overflowPages: [] });
        return;
      }

      container.innerHTML = contentHtml;
      prepareForMeasure(container);

      const available =
        canvas.height -
        style.padding * 2 -
        identifierReservedHeight -
        qrCodeReservedHeight -
        footerReservedHeight;
      const measured = measureBlocks(container);
      layoutRef.current = measured;
      const next = paginate(measured.blocks, available);
      setPages(next);
      setLayoutTick((value) => value + 1);
      onPagesChange({
        total: next.length + coverOffset,
        overflowPages: next
          .map((page, index) => (page.overflow ? index + 1 + coverOffset : -1))
          .filter((index) => index > 0),
      });
    }, [
      contentHtml,
      style,
      imagesTick,
      onPagesChange,
      coverOffset,
      identifierReservedHeight,
      qrCodeReservedHeight,
      footerReservedHeight,
      canvas.height,
    ]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // 把测量容器里的节点克隆进每一张未缩放的导出卡片。
    React.useLayoutEffect(() => {
      const layout = layoutRef.current;
      pages.forEach((page, pageIndex) => {
        const body = bodyRefs.current[pageIndex];
        if (!body) return;
        body.innerHTML = "";
        if (!layout) return;

        const { nodes, targets } = layout;
        for (const placed of page.blocks) {
          const clone = cloneForPage(placed, nodes, targets);
          if (!clone) continue;
          if (placed.childRange) applyListStart(clone, placed.childRange[0]);
          body.appendChild(clone);
        }
      });
    }, [pages, layoutTick]);

    React.useImperativeHandle(
      ref,
      () => ({
        getPageNodes: () =>
          pageRefs.current.filter((node): node is HTMLDivElement => node !== null),
      }),
      [],
    );

    const totalPages = pages.length + coverOffset;
    const pageNumberTotal = pages.length + pageNumberOffset;
    const resolvedCoverText = style.cover.text.trim() || documentTitle;
    const resolvedCoverBackground = style.cover.background || style.accentColor;
    const resolvedCoverTextColor = style.cover.textColor || style.background;

    React.useEffect(() => {
      pageRefs.current.length = totalPages;
    }, [totalPages]);

    const activePage = Math.min(selectedPage, Math.max(0, totalPages - 1));

    const goToPage = (page: number) => {
      setSelectedPage(Math.max(0, Math.min(Math.max(totalPages - 1, 0), page)));
    };

    const cloneRefreshKey = [
      layoutTick,
      totalPages,
      activePage,
      resolvedCoverText,
      resolvedCoverBackground,
      resolvedCoverTextColor,
      profile.avatar,
      profile.name,
      profile.slogan,
      canvas.width,
      canvas.height,
      style.qrCode.enabled,
      style.qrCode.showOnCover,
      style.qrCode.url,
      style.qrCode.position,
      style.qrCode.scale,
      style.showPageNumber,
      style.showPageNumberOnCover,
      pageNumberTotal,
      JSON.stringify(style.cover.graphics),
    ].join(":");

    const fullPreview = (
      <div className="flex h-full flex-col bg-white">
        <PhoneStatusBar />
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/5 px-3">
          <button
            type="button"
            className="-ml-1 flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            aria-label={t("xhs.previewBackToHome")}
            onClick={() => setPreviewMode("home")}
          >
            <ChevronLeft className="size-6" />
          </button>
          <UserAvatar src={profile.avatar} name={profile.name} className="size-7" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {profile.name}
          </span>
          <button
            type="button"
            className="h-6 rounded-full border border-zinc-200 bg-white px-3.5 text-xs text-zinc-500"
          >
            {t("xhs.mockFollowButton")}
          </button>
          <CornerUpRight className="size-5" />
        </div>

        <XhsSwipeCarousel
          pageRefs={pageRefs}
          activePage={activePage}
          totalPages={totalPages}
          sourceWidth={canvas.width}
          sourceHeight={canvas.height}
          refreshKey={cloneRefreshKey}
          emptyMessage={t("xhs.empty")}
          dragLabel={t("xhs.dragPages")}
          previousLabel={t("xhs.prevPage")}
          nextLabel={t("xhs.nextPage")}
          onPageChange={goToPage}
        />

        <article className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          <h2 className="text-base font-bold leading-snug [overflow-wrap:anywhere]">
            {metadata.title}
          </h2>
          {metadata.content ? (
            <p className="whitespace-pre-line text-[13px] leading-5 text-[#333] [overflow-wrap:anywhere]">
              {metadata.content}
            </p>
          ) : null}
          {metadata.tags.length > 0 ? (
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {metadata.tags.map((tag) => (
                <span key={tag} className="text-xs font-medium text-[#315b9d]">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-[11px] text-zinc-400">今天 14:36</p>
        </article>

        <div className="flex h-[52px] shrink-0 items-center gap-3 border-t border-black/5 px-3">
          <div className="min-w-0 flex-1 rounded-full bg-[#f5f5f5] px-3 py-2 text-xs text-zinc-400">
            {t("xhs.mockCommentPlaceholder")}
          </div>
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Star className="size-5" />
        </div>
      </div>
    );

    const homePreview = (
      <div className="flex h-full flex-col overflow-hidden bg-[#f6f6f6]">
        <PhoneStatusBar className="bg-white" />
        <div className="flex h-12 shrink-0 items-center justify-between bg-white px-4 text-sm">
          <span className="font-semibold">{t("xhs.previewModeHome")}</span>
          <div className="flex items-center gap-5">
            <span className="text-zinc-400">{t("xhs.homeFollowing")}</span>
            <span className="relative font-semibold">
              {t("xhs.homeDiscover")}
              <span className="absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#ff2442]" />
            </span>
            <span className="text-zinc-400">{t("xhs.homeNearby")}</span>
          </div>
          <Search className="size-5" />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden p-2">
          <div className="flex min-w-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode("full")}
              className="min-w-0 overflow-hidden rounded-md bg-white text-left transition-opacity hover:opacity-95"
            >
              {totalPages > 0 ? (
                <XhsCardClone
                  pageRefs={pageRefs}
                  pageIndex={0}
                  displayWidth={HOME_CARD_WIDTH}
                  sourceWidth={canvas.width}
                  sourceHeight={canvas.height}
                  refreshKey={cloneRefreshKey}
                />
              ) : (
                <div
                  className="flex items-center justify-center px-4 text-center text-[11px] text-zinc-400"
                  style={{ width: HOME_CARD_WIDTH, height: HOME_CARD_WIDTH * (canvas.height / canvas.width) }}
                >
                  {t("xhs.empty")}
                </div>
              )}
              <div className="space-y-2 p-2.5">
                <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {metadata.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <UserAvatar src={profile.avatar} name={profile.name} className="size-4" />
                    <span className="truncate">{profile.name}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="size-3" /> 128
                  </span>
                </div>
              </div>
            </button>
            <FeedPlaceholder height={142} />
            <FeedPlaceholder height={116} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <FeedPlaceholder height={190} />
            <FeedPlaceholder height={132} />
            <FeedPlaceholder height={168} />
          </div>
        </div>
      </div>
    );

    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: css }} />

        <div className="grid h-[53px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-dashed border-border bg-background/30 px-5 backdrop-blur">
          <div className="flex min-w-0 items-center">
            <div
              className="flex h-8 items-center rounded-md border border-border bg-muted/45 p-0.5"
              aria-label={t("xhs.previewModeLabel")}
            >
              <button
                type="button"
                onClick={() => setPreviewMode("full")}
                aria-pressed={previewMode === "full"}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-medium transition-all",
                  previewMode === "full"
                    ? "bg-card text-brand-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileText className="size-3.5" />
                <span>{t("xhs.previewModeFull")}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("home")}
                aria-pressed={previewMode === "home"}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-medium transition-all",
                  previewMode === "home"
                    ? "bg-card text-brand-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
                <span>{t("xhs.previewModeHome")}</span>
              </button>
            </div>
          </div>
          <ProfileButton onClick={onEditProfile} />
          <div className="flex items-center justify-self-end gap-1.5">
            <Button
              size="sm"
              className="border border-brand-primary/30 bg-brand-primary/10 text-brand-primary shadow-none hover:bg-brand-primary/15"
              disabled={exportDisabled}
              // 必须包一层：直接传 onExport 会把 MouseEvent 当成「导出第几页」的实参。
              onClick={() => onExport()}
              title={t("xhs.exportAll", { n: totalPages })}
            >
              {exporting ? <Loader2 className="animate-spin" /> : <ImageDown />}
              {t("xhs.export")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={exportDisabled}
                  aria-label={t("common.more")}
                  title={t("common.more")}
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onExportPage(activePage)}>
                  <ImageDown />
                  {t("xhs.exportCurrent")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          ref={previewStageRef}
          data-testid="xhs-preview-stage"
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background/25 px-6 pt-4 pb-12"
        >
          <PhoneFrame scale={phoneScale} screenClassName="text-[#222]">
            {previewMode === "full" ? fullPreview : homePreview}
          </PhoneFrame>

          {previewMode === "full" && totalPages > 1 ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-2 left-2 z-10 h-7 w-7 rounded-full backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border disabled:opacity-25",
                  activePage === totalPages - 1
                    ? "bg-background/65 text-foreground/85 opacity-100 ring-1 ring-border/60"
                    : "bg-background/25 text-muted-foreground/55 opacity-50",
                )}
                onClick={() => goToPage(0)}
                disabled={activePage === 0}
                aria-label={t("xhs.firstPage")}
                title={t("xhs.firstPage")}
              >
                <ChevronFirst className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-2 right-2 z-10 h-7 w-7 rounded-full backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border disabled:opacity-25",
                  activePage === 0
                    ? "bg-background/65 text-foreground/85 opacity-100 ring-1 ring-border/60"
                    : "bg-background/25 text-muted-foreground/55 opacity-50",
                )}
                onClick={() => goToPage(totalPages - 1)}
                disabled={activePage === totalPages - 1}
                aria-label={t("xhs.lastPage")}
                title={t("xhs.lastPage")}
              >
                <ChevronLast className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}

          <div className="absolute bottom-2 left-2 flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                setPreviewZoom((zoom) =>
                  Math.max(Math.round((zoom - ZOOM_STEP) * 10) / 10, ZOOM_MIN)
                )
              }
              disabled={previewZoom <= ZOOM_MIN}
              title={t("xhs.zoomOut")}
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
              onClick={() =>
                setPreviewZoom((zoom) =>
                  Math.min(Math.round((zoom + ZOOM_STEP) * 10) / 10, ZOOM_MAX)
                )
              }
              disabled={previewZoom >= ZOOM_MAX}
              title={t("xhs.zoomIn")}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPreviewZoom(1)}
              disabled={previewZoom === 1}
              title={t("xhs.zoomReset")}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          {previewMode === "full" && totalPages > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 bottom-2 z-10 h-7 w-7 rounded-full bg-background/25 text-muted-foreground/55 opacity-50 backdrop-blur-sm hover:bg-background/75 hover:text-foreground hover:opacity-100 focus-visible:bg-background/75 focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border data-[state=open]:bg-background/75 data-[state=open]:text-foreground data-[state=open]:opacity-100"
                  aria-label={t("xhs.pageNavigator")}
                  title={t("xhs.pageNavigator")}
                >
                  <TableOfContents className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="grid max-h-72 w-56 grid-cols-4 gap-1 overflow-y-auto"
              >
                <DropdownMenuLabel className="col-span-4">
                  {t("xhs.pageNavigator")}
                </DropdownMenuLabel>
                {Array.from({ length: totalPages }, (_, index) => (
                  <DropdownMenuItem
                    key={index}
                    className={cn(
                      "justify-center px-1 text-xs tabular-nums",
                      index === activePage && "bg-accent text-accent-foreground",
                    )}
                    aria-label={t("xhs.goToPage", { page: index + 1 })}
                    onSelect={() => goToPage(index)}
                  >
                    {index + 1}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* 离屏测量容器：宽度与卡片内容区完全一致，才能量出真实换行。 */}
        <div
          aria-hidden
          className={XHS_CARD_CLASS}
          ref={measureRef}
          style={{
            position: "fixed",
            top: 0,
            left: -100_000,
            width: innerWidth,
            visibility: "hidden",
            pointerEvents: "none",
            zIndex: -1,
            background: "transparent",
          }}
        />

        {/*
          未缩放的导出 DOM 常驻离屏区域；手机预览逐张 clone 这些节点。
          不能 display:none / visibility:hidden，否则浏览器导出时会把卡片画成空白。
        */}
        <div
          aria-hidden
          style={{ position: "fixed", top: 0, left: -100_000, width: canvas.width, zIndex: -1 }}
        >
          {style.cover.enabled ? (
            <div
              ref={(node) => {
                pageRefs.current[0] = node;
              }}
              className={cn(XHS_CARD_CLASS, "relative flex flex-col overflow-hidden")}
              style={{
                width: canvas.width,
                height: canvas.height,
                padding: style.padding,
                background: resolvedCoverBackground,
                color: resolvedCoverTextColor,
              }}
            >
              <CoverGraphicsLayer
                graphics={style.cover.graphics}
                canvasWidth={canvas.width}
              />
              {identifierAtTop && style.identifier.showOnCover ? (
                <XhsIdentifier
                  identifier={style.identifier}
                  profile={profile}
                  color={resolvedCoverTextColor}
                  accentColor={style.accentColor}
                  className="relative z-10"
                  style={{ marginBottom: identifierGap }}
                />
              ) : null}
              {qrCodeAtTop && style.qrCode.showOnCover ? (
                <XhsQrCode
                  qrCode={style.qrCode}
                  style={{ marginBottom: qrCodeGap }}
                />
              ) : null}
              <div
                className="relative z-10 flex min-h-0 flex-1 flex-col justify-center"
                style={{ marginInline: COVER_TITLE_PADDING - style.padding }}
              >
                <h1
                  className="m-0"
                  style={{
                    width: "100%",
                    color: resolvedCoverTextColor,
                    fontSize: style.cover.fontSize,
                    fontWeight: style.cover.fontWeight,
                    lineHeight: style.cover.lineHeight,
                    textAlign: style.cover.align,
                    letterSpacing: "0.01em",
                    whiteSpace: "pre-wrap",
                    wordBreak: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  {resolvedCoverText}
                </h1>
              </div>
              {!identifierAtTop && style.identifier.showOnCover ? (
                <XhsIdentifier
                  identifier={style.identifier}
                  profile={profile}
                  color={resolvedCoverTextColor}
                  accentColor={style.accentColor}
                  className="relative z-10"
                  style={{ marginTop: identifierGap }}
                />
              ) : null}
              {!qrCodeAtTop && style.qrCode.showOnCover ? (
                <XhsQrCode
                  qrCode={style.qrCode}
                  style={{ marginTop: qrCodeGap }}
                />
              ) : null}
              {style.showPageNumber && style.showPageNumberOnCover ? (
                <div
                  className="ft-xhs-footer"
                  style={{ color: resolvedCoverTextColor, zIndex: 10 }}
                >
                  <span className="ft-xhs-page-dot">
                    <span>1</span>
                    <span style={{ marginInline: style.pageNumberGap }}> / </span>
                    <span>{pageNumberTotal}</span>
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {pages.map((page, index) => (
            <div
              key={index}
              ref={(node) => {
                pageRefs.current[index + coverOffset] = node;
              }}
              className={cn(XHS_CARD_CLASS, "relative flex flex-col")}
              style={{
                width: canvas.width,
                height: canvas.height,
                padding: style.padding,
              }}
            >
              {identifierAtTop ? (
                <XhsIdentifier
                  identifier={style.identifier}
                  profile={profile}
                  color={style.textColor}
                  accentColor={style.accentColor}
                  style={{ marginBottom: identifierGap }}
                />
              ) : null}
              {qrCodeAtTop ? (
                <XhsQrCode
                  qrCode={style.qrCode}
                  style={{ marginBottom: qrCodeGap }}
                />
              ) : null}
              <div
                className="ft-xhs-body min-h-0 flex-1 overflow-hidden"
                ref={(node) => {
                  bodyRefs.current[index] = node;
                }}
              />
              {!identifierAtTop ? (
                <XhsIdentifier
                  identifier={style.identifier}
                  profile={profile}
                  color={style.textColor}
                  accentColor={style.accentColor}
                  style={{ marginTop: identifierGap }}
                />
              ) : null}
              {!qrCodeAtTop ? (
                <XhsQrCode
                  qrCode={style.qrCode}
                  style={{ marginTop: qrCodeGap }}
                />
              ) : null}
              {style.showPageNumber ? (
                <div className="ft-xhs-footer">
                  <span className="ft-xhs-page-dot">
                    <span>{index + 1 + pageNumberOffset}</span>
                    <span style={{ marginInline: style.pageNumberGap }}> / </span>
                    <span>{pageNumberTotal}</span>
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {pages.some((page) => page.overflow) ? (
          <p className="sr-only" style={{ color: palette.muted }}>
            {t("xhs.pageOverflow", {
              page: pages.findIndex((page) => page.overflow) + 1 + coverOffset,
            })}
          </p>
        ) : null}
      </div>
    );
  },
));
