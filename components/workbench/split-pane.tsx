"use client";

import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { useElementWidth } from "@/hooks/use-media-query";
import { MIN_EDITOR_WIDTH, MIN_PREVIEW_WIDTH, NARROW_BREAKPOINT } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";

interface SplitPaneProps {
  /** 左侧预览，三个视图统一是「左预览、右编辑」（PRD 产品原则 10）。 */
  preview: React.ReactNode;
  editor: React.ReactNode;
  ratio: number;
  defaultRatio: number;
  /** 拖动结束后才写 localStorage（PRD FT-LYT-003）。 */
  onRatioCommit: (ratio: number) => void;
  /** 窄屏时显示哪一侧（PRD FT-LYT-004）。 */
  narrowSide: "preview" | "editor";
  onNarrowChange: (narrow: boolean) => void;
  previewLabel: string;
  editorLabel: string;
}

export function SplitPane({
  preview,
  editor,
  ratio,
  defaultRatio,
  onRatioCommit,
  narrowSide,
  onNarrowChange,
  previewLabel,
  editorLabel,
}: SplitPaneProps) {
  const t = useT();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [dragRatio, setDragRatio] = React.useState<number | null>(null);
  const dragging = dragRatio !== null;

  // 宽度不够放下两栏时降级为单栏，且不动已保存的桌面端比例。
  const narrow = width > 0 && width < NARROW_BREAKPOINT;
  React.useEffect(() => {
    onNarrowChange(narrow);
  }, [narrow, onNarrowChange]);

  const effectiveRatio = dragRatio ?? ratio;

  /** 把像素位置换算成比例，并保证两侧都不低于最小可操作宽度。 */
  const ratioFromClientX = React.useCallback(
    (clientX: number) => {
      const element = containerRef.current;
      if (!element || width <= 0) return effectiveRatio;
      const bounds = element.getBoundingClientRect();
      const raw = (clientX - bounds.left) / width;
      const min = MIN_PREVIEW_WIDTH / width;
      const max = 1 - MIN_EDITOR_WIDTH / width;
      // 窗口太窄导致上下限交叉时，退回默认比例而不是产生负区间。
      if (min >= max) return effectiveRatio;
      return clamp(raw, min, max);
    },
    [containerRef, width, effectiveRatio],
  );

  React.useEffect(() => {
    if (!dragging) return;

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      // 每帧最多更新一次，拖动时保持接近 60fps（PRD 12.1）。
      frame = requestAnimationFrame(() => setDragRatio(ratioFromClientX(event.clientX)));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      const next = ratioFromClientX(event.clientX);
      setDragRatio(null);
      onRatioCommit(next);
    };

    document.body.classList.add("ft-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.body.classList.remove("ft-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragging, ratioFromClientX, onRatioCommit]);

  const nudge = (delta: number) => {
    if (width <= 0) return;
    const min = MIN_PREVIEW_WIDTH / width;
    const max = 1 - MIN_EDITOR_WIDTH / width;
    if (min >= max) return;
    onRatioCommit(clamp(ratio + delta, min, max));
  };

  if (narrow) {
    return (
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn("min-h-0 flex-1 flex-col", narrowSide === "preview" ? "flex" : "hidden")}
          aria-label={previewLabel}
          role="region"
        >
          {preview}
        </div>
        <div
          className={cn("min-h-0 flex-1 flex-col", narrowSide === "editor" ? "flex" : "hidden")}
          aria-label={editorLabel}
          role="region"
        >
          {editor}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
        className="flex min-w-0 flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${effectiveRatio * 100}%` }}
        role="region"
        aria-label={previewLabel}
      >
        {preview}
      </div>

      <div className="relative z-20 w-px shrink-0">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("a11y.splitter")}
          aria-valuenow={Math.round(effectiveRatio * 100)}
          aria-valuemin={Math.round((MIN_PREVIEW_WIDTH / Math.max(width, 1)) * 100)}
          aria-valuemax={100 - Math.round((MIN_EDITOR_WIDTH / Math.max(width, 1)) * 100)}
          tabIndex={0}
          title={t("layout.dragHint")}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragRatio(ratioFromClientX(event.clientX));
          }}
          // 双击恢复该视图默认比例（PRD FT-LYT-001）。
          onDoubleClick={() => onRatioCommit(defaultRatio)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-0.02);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(0.02);
            } else if (event.key === "Home") {
              event.preventDefault();
              onRatioCommit(defaultRatio);
            }
          }}
          className={cn(
            "group absolute inset-y-0 left-0 w-px cursor-col-resize bg-border",
            "before:absolute before:inset-y-0 before:-inset-x-2",
            "transition-colors hover:bg-brand-secondary focus-visible:bg-brand-secondary focus-visible:outline-none",
            dragging && "bg-brand-primary",
          )}
        >
          <span
            aria-hidden="true"
            data-slot="split-pane-drag-handle"
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 h-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/45",
              "transition-[background-color,transform] duration-150 group-hover:scale-y-110 group-hover:bg-brand-primary group-focus-visible:scale-y-110 group-focus-visible:bg-brand-primary",
              dragging && "scale-y-110 bg-brand-primary",
            )}
          />
        </div>
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        role="region"
        aria-label={editorLabel}
      >
        {editor}
      </div>
    </div>
  );
}
