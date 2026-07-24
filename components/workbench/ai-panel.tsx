"use client";

import {
  ArrowDownToLine,
  Copy,
  Loader2,
  RefreshCw,
  Replace,
  Settings2,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useAi } from "@/components/providers/ai-provider";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Separator } from "@/components/ui/misc";
import { cleanAiOutput, runAction } from "@/lib/ai/client";
import { AI_ACTIONS, type AiAction } from "@/lib/ai/types";
import { chatCompletionsUrl } from "@/lib/ai/errors";
import type { TKey } from "@/lib/i18n";

/** 只发送选区前后各这么多字符，避免整篇文章被送出去（PRD FT-AI-003）。 */
const CONTEXT_CHARS = 400;

const ACTION_LABELS: Record<AiAction, TKey> = {
  polish: "ai.actionPolish",
  expand: "ai.actionExpand",
  condense: "ai.actionCondense",
  custom: "ai.actionCustom",
};

interface AiPanelProps {
  editorRef: React.RefObject<EditorApi | null>;
  onClose: () => void;
}

export function AiPanel({ editorRef, onClose }: AiPanelProps) {
  const t = useT();
  const { config, configured, openSettings } = useAi();

  const [instruction, setInstruction] = React.useState("");
  const [selection, setSelection] = React.useState("");
  const [result, setResult] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<AiAction | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const target = chatCompletionsUrl(config.baseUrl);

  const start = React.useCallback(
    async (action: AiAction) => {
      const api = editorRef.current;
      if (!api) return;

      const { text } = api.getSelection();
      if (!text.trim()) {
        toast.warning(t("ai.selectionRequired"));
        api.focus();
        return;
      }
      if (action === "custom" && !instruction.trim()) {
        toast.warning(t("ai.customPlaceholder"));
        return;
      }

      const context = api.getContextAround(CONTEXT_CHARS);
      const controller = new AbortController();
      abortRef.current = controller;

      setSelection(text);
      setLastAction(action);
      setResult("");
      setRunning(true);

      const response = await runAction(
        config,
        {
          action,
          selection: text,
          contextBefore: context.before,
          contextAfter: context.after,
          customInstruction: instruction,
        },
        {
          onDelta: (delta) => setResult((current) => current + delta),
          onFallbackToBlocking: () => toast.info(t("ai.errNoStream")),
        },
        controller.signal,
      );

      setRunning(false);
      abortRef.current = null;

      if (response.ok) {
        if (!response.content.trim()) toast.warning(t("ai.emptyResult"));
        setResult(response.content);
        return;
      }
      if (response.canceled) {
        toast.info(t("ai.canceled"));
        setResult(response.content ?? "");
        return;
      }
      // 鉴权、模型名之类的错误不自动重试，直接引导用户改配置（PRD 第 11 节）。
      toast.error(t(response.error.messageKey, response.error.params));
      setResult("");
    },
    [config, editorRef, instruction, t],
  );

  const stop = () => abortRef.current?.abort();

  const cleaned = React.useMemo(() => cleanAiOutput(result), [result]);

  const apply = (mode: "replace" | "insert") => {
    const api = editorRef.current;
    if (!api || !cleaned) return;
    if (mode === "replace") {
      api.replaceSelection(cleaned);
      toast.success(t("ai.replaced"));
    } else {
      api.insertAfterSelection(cleaned);
      toast.success(t("ai.inserted"));
    }
    setResult("");
    setSelection("");
  };

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // 未配置时不隐藏入口，而是引导到配置（PRD FT-AI-006）。
  if (!configured) {
    return (
      <div className="flex flex-col gap-3 border-t border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="size-4" aria-hidden />
          {t("ai.notConfigured")}
        </div>
        <p className="text-sm text-muted-foreground">{t("ai.configurePrompt")}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={openSettings}>
            <Settings2 />
            {t("ai.configureNow")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("ai.skip")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[45vh] flex-col overflow-y-auto border-t border-border bg-card">
      <div className="flex flex-wrap items-center gap-1.5 p-3">
        {AI_ACTIONS.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={lastAction === action ? "default" : "outline"}
            disabled={running}
            onClick={() => void start(action)}
          >
            {t(ACTION_LABELS[action])}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          {running ? (
            <Button size="sm" variant="ghost" onClick={stop}>
              <Square />
              {t("ai.stop")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={openSettings}>
            <Settings2 />
            {t("ai.settings")}
          </Button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t("ai.customPlaceholder")}
          aria-label={t("ai.actionCustom")}
          className="min-h-[44px] text-sm"
          rows={2}
        />
        {target ? (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            {t("ai.requestTarget", { url: target })}
          </p>
        ) : null}
      </div>

      {running || result ? (
        <>
          <Separator />
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              <span>{running ? t("ai.running") : t("ai.result")}</span>
              {selection ? (
                <span className="ml-auto">
                  {t("ai.contextNotice", { n: selection.length })}
                </span>
              ) : null}
            </div>

            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
              {cleaned || (running ? "" : t("ai.emptyResult"))}
            </div>

            {/* 结果永远不会自动覆盖正文，必须由用户点击（PRD FT-AI-004） */}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" disabled={running || !cleaned} onClick={() => apply("replace")}>
                <Replace />
                {t("ai.replace")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={running || !cleaned}
                onClick={() => apply("insert")}
              >
                <ArrowDownToLine />
                {t("ai.insertAfter")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={running || !lastAction}
                onClick={() => lastAction && void start(lastAction)}
              >
                <RefreshCw />
                {t("ai.regenerate")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!cleaned}
                onClick={() => {
                  void navigator.clipboard.writeText(cleaned);
                  toast.success(t("common.copied"));
                }}
              >
                <Copy />
                {t("ai.copyResult")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={running}
                onClick={() => {
                  setResult("");
                  setSelection("");
                }}
              >
                <Trash2 />
                {t("ai.discard")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
