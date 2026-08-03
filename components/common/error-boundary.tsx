"use client";

import * as React from "react";

import { detectLocale, translate, type Locale } from "@/lib/i18n";
import { StorageKey } from "@/lib/storage";

/**
 * 全局错误边界：任何子组件渲染崩溃时展示降级 UI，
 * 从 localStorage 直接读取草稿正文供用户复制，避免白屏丢稿。
 */

interface ErrorBoundaryState {
  error: Error | null;
}

/** 不依赖任何 Provider，直接从 localStorage 读取草稿内容。 */
function readDraftContent(): string {
  try {
    const raw = window.localStorage.getItem(StorageKey.draft);
    if (!raw) return "";
    const envelope = JSON.parse(raw) as { v?: number; data?: { content?: string } };
    return envelope?.data?.content ?? "";
  } catch {
    return "";
  }
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleCopy = async () => {
    const content = readDraftContent();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // 剪贴板不可用时用户仍可手动选中 textarea 内容
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ErrorFallback error={this.state.error} onReset={this.handleReset} onCopy={this.handleCopy} />
    );
  }
}

function ErrorFallback({
  error,
  onReset,
  onCopy,
}: {
  error: Error;
  onReset: () => void;
  onCopy: () => void;
}) {
  const locale: Locale =
    typeof navigator === "undefined"
      ? "zh"
      : detectLocale(navigator.languages ?? [navigator.language]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [content] = React.useState(readDraftContent);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="max-w-lg space-y-3 text-center">
        <h1 className="text-lg font-semibold text-destructive">{t("common.errorPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("common.errorPageBody")}</p>
        <details className="rounded bg-muted px-3 py-2 text-left">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground">
            {t("common.errorDetails")}
          </summary>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{error.message}</p>
        </details>
      </div>

      {content ? (
        <textarea
          readOnly
          defaultValue={content}
          className="h-48 w-full max-w-lg resize-y rounded-lg border border-border bg-card p-3 font-mono text-sm"
          aria-label={t("common.draftContent")}
        />
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!content}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {copied ? t("common.draftCopied") : t("common.copyDraft")}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          {t("common.tryRecover")}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t("common.refreshPage")}
        </button>
      </div>
    </div>
  );
}
