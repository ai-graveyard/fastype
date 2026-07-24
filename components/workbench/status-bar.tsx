"use client";

import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";

const STATUS_BAR_CLASS =
  "flex min-h-8 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-border bg-background/35 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground";

interface PreviewStatusBarProps {
  summary?: React.ReactNode;
  status?: React.ReactNode;
}

export function PreviewStatusBar({ summary, status }: PreviewStatusBarProps) {
  const t = useT();

  return (
    <footer aria-label={t("a11y.previewStatusBar")} className={STATUS_BAR_CLASS}>
      <div className="flex min-w-0 items-center gap-3">{summary}</div>
      {status ? (
        <div className="ml-auto flex shrink-0 items-center gap-2 text-right">{status}</div>
      ) : null}
    </footer>
  );
}

interface StatusBarProps {
  /** 编辑器 Footer：左侧是光标/选区，右侧是平台限制与全文统计。 */
  limitStatus?: React.ReactNode;
  words: number;
  chars: number;
  lines: number;
  line: number;
  col: number;
  selectionLength: number;
  actions?: React.ReactNode;
}

export function StatusBar({
  limitStatus,
  words,
  chars,
  lines,
  line,
  col,
  selectionLength,
  actions,
}: StatusBarProps) {
  const t = useT();

  return (
    <footer
      aria-label={t("a11y.editorStatusBar")}
      className={STATUS_BAR_CLASS}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span>{t("status.cursor", { line, col })}</span>
        {selectionLength > 0 ? (
          <span>{t("status.selection", { n: selectionLength })}</span>
        ) : null}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        {limitStatus}
        <span>{t("status.words", { n: words })}</span>
        <span>{t("status.chars", { n: chars })}</span>
        <span>{t("status.lines", { n: lines })}</span>
        {actions ? <span className="flex items-center gap-1.5">{actions}</span> : null}
      </div>
    </footer>
  );
}
