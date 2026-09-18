"use client";

import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { subscribeImageStorageIssue, type ImageStorageIssue } from "@/lib/image/db";
import { subscribeQuotaExhausted } from "@/lib/storage";

/**
 * 持久性配额警告横幅：localStorage 配额耗尽时常驻顶部，
 * 直到配额恢复（自动重试每 30s 探测一次）。
 */
export function QuotaWarningBanner() {
  const t = useT();
  const [exhausted, setExhausted] = React.useState(false);
  const [imageIssue, setImageIssue] = React.useState<ImageStorageIssue | null>(null);

  React.useEffect(() => subscribeQuotaExhausted(setExhausted), []);
  React.useEffect(() => subscribeImageStorageIssue(setImageIssue), []);

  if (!exhausted && !imageIssue) return null;

  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.75a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      <span>
        {t(
          exhausted
            ? "settings.storageQuota"
            : imageIssue === "quota"
              ? "settings.imageStorageQuota"
              : "settings.imageStorageUnavailable",
        )}
      </span>
    </div>
  );
}
