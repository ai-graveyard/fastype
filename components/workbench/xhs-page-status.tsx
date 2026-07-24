"use client";

import { useT } from "@/components/providers/prefs-provider";
import { PreviewStatusBar } from "@/components/workbench/status-bar";
import { isXhsImagePagesOverLimit, XHS_LIMITS } from "@/lib/themes/xhs";
import { cn } from "@/lib/utils";

interface XhsPageStatusProps {
  total: number;
  ratio: string;
  width: number;
  height: number;
  onOpenCanvasSettings: () => void;
  overflowPages?: number[];
  failedImages?: number;
  exporting?: { current: number; total: number } | null;
}

export function XhsPageStatus({
  total,
  ratio,
  width,
  height,
  onOpenCanvasSettings,
  overflowPages = [],
  failedImages = 0,
  exporting = null,
}: XhsPageStatusProps) {
  const t = useT();
  const overLimit = isXhsImagePagesOverLimit(total);
  let severity: "progress" | "warning" | "error" | undefined;
  let message = t("xhs.previewReady");

  if (exporting) {
    severity = "progress";
    message = t("xhs.previewExporting", exporting);
  } else if (failedImages > 0) {
    severity = "error";
    message = t("xhs.previewImagesFailed", { n: failedImages });
  } else if (overflowPages.length > 0) {
    severity = "warning";
    message = t("xhs.previewOverflow", { page: overflowPages[0] });
  } else if (overLimit) {
    severity = "warning";
    message = t("xhs.previewPageLimitOver", { max: XHS_LIMITS.imagePages });
  } else if (total === 0) {
    message = t("xhs.previewEmpty");
  }

  return (
    <PreviewStatusBar
      summary={
        <span className="flex items-center gap-1.5 tabular-nums">
          <span>{t("xhs.previewImageCount", { n: total })}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onOpenCanvasSettings}
            aria-label={t("xhs.openCanvasSettings", { ratio, width, height })}
            title={t("xhs.openCanvasSettings", { ratio, width, height })}
            className="cursor-pointer rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45"
          >
            {t("xhs.previewCanvasSize", { ratio, width, height })}
          </button>
        </span>
      }
      status={
        <span
          className={cn(
            "font-medium normal-case tracking-normal",
            severity === "progress" && "text-brand-primary",
            severity === "warning" && "text-warning",
            severity === "error" && "text-destructive",
          )}
          data-severity={severity}
        >
          {message}
        </span>
      }
    />
  );
}
