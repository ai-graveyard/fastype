"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AlertTriangle, ChevronUp, LocateFixed } from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { PreviewStatusBar } from "@/components/workbench/status-bar";
import type {
  WechatCompatibilityIssue,
  WechatWarning,
} from "@/lib/render/wechat";
import { cn } from "@/lib/utils";

interface WechatPreviewStatusProps {
  images: number;
  subheadings: number;
  readingMinutes: number;
  remoteImages: number;
  failedImages?: number;
  warnings?: WechatWarning[];
  issues?: WechatCompatibilityIssue[];
  hasContent: boolean;
  onLocateIssue?: (issue: WechatCompatibilityIssue) => void;
}

export function WechatPreviewStatus({
  images,
  subheadings,
  readingMinutes,
  remoteImages,
  failedImages = 0,
  warnings = [],
  issues = [],
  hasContent,
  onLocateIssue,
}: WechatPreviewStatusProps) {
  const t = useT();
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  let severity: "warning" | "error" | undefined;
  let message = hasContent ? t("wechat.previewReady") : t("wechat.previewEmpty");
  const compatibilityCount = issues.length || warnings.length;
  const onlyImageIssues =
    issues.length > 0 && issues.every((issue) => issue.warning === "wechat.compatImage");

  if (failedImages > 0) {
    severity = "error";
    message = t("wechat.previewImagesFailed", { n: failedImages });
  } else if (compatibilityCount > 0) {
    severity = "warning";
    message =
      onlyImageIssues && remoteImages > 0
        ? t("wechat.previewRemoteImages", { n: remoteImages })
        : t("wechat.previewWarnings", { n: compatibilityCount });
  }

  const warningDetails = warnings.map((warning) => t(warning)).join("\n");
  const status =
    compatibilityCount > 0 && failedImages === 0 && issues.length > 0 ? (
      <CompatibilityDetails
        issues={issues}
        message={message}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onLocateIssue={onLocateIssue}
      />
    ) : (
      <span
        className={cn(
          "font-medium normal-case tracking-normal",
          severity === "warning" && "text-warning",
          severity === "error" && "text-destructive",
        )}
        data-severity={severity}
        title={warningDetails || undefined}
      >
        {message}
      </span>
    );

  return (
    <PreviewStatusBar
      summary={
        <span className="tabular-nums">
          {t("wechat.previewSummary", {
            images,
            headings: subheadings,
            minutes: readingMinutes,
          })}
        </span>
      }
      status={status}
    />
  );
}

const ISSUE_LABEL_KEYS: Record<WechatWarning, "wechat.compatIssueTable" | "wechat.compatIssueCode" | "wechat.compatIssueLink" | "wechat.compatIssueImage"> = {
  "wechat.compatTable": "wechat.compatIssueTable",
  "wechat.compatCode": "wechat.compatIssueCode",
  "wechat.compatLink": "wechat.compatIssueLink",
  "wechat.compatImage": "wechat.compatIssueImage",
};

function CompatibilityDetails({
  issues,
  message,
  open,
  onOpenChange,
  onLocateIssue,
}: {
  issues: WechatCompatibilityIssue[];
  message: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocateIssue?: (issue: WechatCompatibilityIssue) => void;
}) {
  const t = useT();

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm font-medium normal-case tracking-normal text-warning outline-none transition-colors hover:text-warning/80 focus-visible:ring-2 focus-visible:ring-ring/40"
          data-severity="warning"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          {message}
          <ChevronUp
            className={cn("size-3 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={8}
          aria-label={t("wechat.compatDetailsTitle")}
          className={cn(
            "z-50 w-[25rem] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
              {t("wechat.compatDetailsTitle")}
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] tabular-nums text-warning">
                {issues.length}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("wechat.compatDetailsDescription")}
            </p>
          </div>

          <ol className="max-h-80 space-y-2 overflow-y-auto p-3">
            {issues.map((issue) => {
              const location = t(ISSUE_LABEL_KEYS[issue.warning], { n: issue.index });
              return (
                <li
                  key={`${issue.warning}-${issue.index}`}
                  className="rounded-lg border border-border/80 bg-background/45 p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/10 text-[10px] font-semibold tabular-nums text-warning">
                      {issue.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{location}</p>
                      {issue.preview ? (
                        <p className="mt-1 truncate rounded bg-muted/55 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {issue.preview}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {t(issue.warning)}
                      </p>
                      {issue.searchText && onLocateIssue ? (
                        <PopoverPrimitive.Close asChild>
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                            aria-label={`${t("wechat.compatLocate")}：${location}`}
                            onClick={() => onLocateIssue(issue)}
                          >
                            <LocateFixed className="size-3" aria-hidden="true" />
                            {t("wechat.compatLocate")}
                          </button>
                        </PopoverPrimitive.Close>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
