"use client";

import {
  Copy,
  Eraser,
  Loader2,
  RefreshCw,
  Replace,
  ShieldCheck,
  Square,
  SquarePen,
  SquareSplitHorizontal,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useAi } from "@/components/providers/ai-provider";
import { useT } from "@/components/providers/prefs-provider";
import { AiDiffView } from "@/components/workbench/ai-diff-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { cleanAiOutput, runDocumentAction } from "@/lib/ai/client";
import { computeDiffSegments, diffStats } from "@/lib/ai/diff";
import type { AiDocumentAction } from "@/lib/ai/types";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AiQuickActionPlatform = "common" | "xiaohongshu" | "wechat";

const ACTIONS: Array<{
  action: AiDocumentAction;
  label: TKey;
  description: TKey;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    action: "humanize",
    label: "ai.humanize",
    description: "ai.humanizeDescription",
    icon: Eraser,
  },
  {
    action: "sensitive",
    label: "ai.sensitive",
    description: "ai.sensitiveDescription",
    icon: ShieldCheck,
  },
];

const PLATFORM_LABELS: Record<AiQuickActionPlatform, RunPlatform> = {
  common: "通用内容平台",
  xiaohongshu: "小红书",
  wechat: "微信公众号",
};

type RunPlatform = "通用内容平台" | "小红书" | "微信公众号";

interface AiQuickActionsProps {
  editorRef: React.RefObject<EditorApi | null>;
  platform?: AiQuickActionPlatform;
}

export function AiQuickActions({
  editorRef,
  platform = "common",
}: AiQuickActionsProps) {
  const t = useT();
  const { config, configured, openSettings } = useAi();
  const [open, setOpen] = React.useState(false);
  const [action, setAction] = React.useState<AiDocumentAction | null>(null);
  const [original, setOriginal] = React.useState("");
  const [result, setResult] = React.useState("");
  const [running, setRunning] = React.useState(false);
  /** 弹框已打开但用户尚未手动触发 AI 请求。 */
  const [pending, setPending] = React.useState(false);
  /** 结果生成完成后默认切到差异对比；生成过程中固定停在编辑视图看流式输出。 */
  const [mode, setMode] = React.useState<"diff" | "edit">("edit");
  const abortRef = React.useRef<AbortController | null>(null);

  const actionMeta = ACTIONS.find((item) => item.action === action);
  const cleanedResult = cleanAiOutput(result);
  /** 只在切到差异对比视图时才算 diff，避免流式输出期间每个字符都重新计算。 */
  const diffSegments = React.useMemo(
    () => (mode === "diff" ? computeDiffSegments(original, cleanedResult) : []),
    [mode, original, cleanedResult],
  );
  const stats = React.useMemo(() => diffStats(diffSegments), [diffSegments]);

  /** 点击快捷按钮：校验后打开弹框，等待用户手动触发。 */
  const openFor = React.useCallback(
    (nextAction: AiDocumentAction) => {
      const content = editorRef.current?.getValue() ?? "";
      if (!content.trim()) {
        toast.warning(t("ai.documentRequired"));
        editorRef.current?.focus();
        return;
      }
      if (!configured) {
        toast.info(t("ai.configurePrompt"));
        openSettings();
        return;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      setAction(nextAction);
      setOriginal(content);
      setResult("");
      setRunning(false);
      setPending(true);
      setMode("edit");
      setOpen(true);
    },
    [configured, editorRef, openSettings, t],
  );

  /** 在弹框内手动触发 AI 请求。 */
  const start = React.useCallback(
    async (nextAction: AiDocumentAction, source?: string) => {
      const content = source ?? editorRef.current?.getValue() ?? "";
      if (!content.trim()) {
        toast.warning(t("ai.documentRequired"));
        editorRef.current?.focus();
        return;
      }
      if (!configured) {
        toast.info(t("ai.configurePrompt"));
        openSettings();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAction(nextAction);
      setOriginal(content);
      setResult("");
      setRunning(true);
      setPending(false);
      setMode("edit");
      setOpen(true);

      const response = await runDocumentAction(
        config,
        {
          action: nextAction,
          content,
          platform: PLATFORM_LABELS[platform],
        },
        {
          onDelta: (delta) => setResult((current) => current + delta),
          onFallbackToBlocking: () => toast.info(t("ai.errNoStream")),
        },
        controller.signal,
      );

      if (abortRef.current !== controller) return;
      abortRef.current = null;
      setRunning(false);

      if (response.ok) {
        const cleaned = cleanAiOutput(response.content);
        setResult(cleaned);
        if (cleaned) {
          setMode("diff");
        } else {
          toast.warning(t("ai.emptyResult"));
        }
        return;
      }
      if (response.canceled) {
        setResult(cleanAiOutput(response.content ?? ""));
        return;
      }
      toast.error(t(response.error.messageKey, response.error.params));
      setResult("");
    },
    [config, configured, editorRef, openSettings, platform, t],
  );

  const close = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setPending(false);
    setOpen(false);
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const apply = () => {
    const current = editorRef.current?.getValue() ?? "";
    if (current !== original) {
      toast.warning(t("ai.documentChanged"));
      return;
    }
    const cleaned = cleanAiOutput(result);
    if (!cleaned) return;
    editorRef.current?.replaceDocument(cleaned);
    toast.success(t("ai.documentReplaced"));
    close();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cleanAiOutput(result));
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <>
      <div
        className="absolute right-3 top-3 z-30 flex flex-col items-center gap-2"
        aria-label={t("ai.quickActions")}
      >
        {ACTIONS.map((item) => (
          <Tooltip key={item.action} label={t(item.label)} side="left">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "size-9 rounded-full border-border bg-card/90 shadow-lg backdrop-blur-sm",
                "hover:border-brand-primary/45 hover:bg-card hover:text-brand-primary hover:shadow-xl",
                action === item.action && running &&
                  "border-brand-primary/45 text-brand-primary shadow-md",
              )}
              aria-label={t(item.label)}
              disabled={running}
              onClick={() => openFor(item.action)}
            >
              {action === item.action && running ? (
                <Loader2 className="animate-spin" />
              ) : (
                <item.icon />
              )}
            </Button>
          </Tooltip>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent
          closeLabel={t("common.close")}
          className="max-h-[82vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto]"
          onEscapeKeyDown={(event) => running && event.preventDefault()}
          onPointerDownOutside={(event) => running && event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              {actionMeta ? <actionMeta.icon className="size-4 text-brand-primary" /> : null}
              {actionMeta ? t(actionMeta.label) : t("ai.result")}
            </DialogTitle>
            <DialogDescription>
              {pending
                ? t("ai.pendingHint")
                : running
                  ? t("ai.documentRunning")
                  : actionMeta
                    ? t(actionMeta.description)
                    : t("ai.result")}
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <div className="flex min-h-0 flex-col items-center justify-center gap-4 py-12 text-center">
              {actionMeta ? (
                <actionMeta.icon className="size-10 text-muted-foreground/40" />
              ) : null}
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("ai.pendingDescription")}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{mode === "diff" ? t("ai.diffHint") : t("ai.previewBeforeReplace")}</span>
                {mode === "diff" ? (
                  <span className="tabular-nums">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{stats.added}
                    </span>
                    <span className="mx-1">/</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -{stats.removed}
                    </span>
                    <span className="ml-1">{t("ai.diffStatsUnit")}</span>
                  </span>
                ) : (
                  <span>{t("ai.resultChars", { n: cleanedResult.length })}</span>
                )}
              </div>

              <Tabs
                value={mode}
                onValueChange={(value) => setMode(value as "diff" | "edit")}
                className="min-h-0 flex-1 gap-2"
              >
                <TabsList>
                  <TabsTrigger value="diff" disabled={running}>
                    <SquareSplitHorizontal />
                    {t("ai.diffView")}
                  </TabsTrigger>
                  <TabsTrigger value="edit">
                    <SquarePen />
                    {t("ai.editView")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="diff" className="flex min-h-0 flex-col">
                  <AiDiffView
                    segments={diffSegments}
                    hasResult={Boolean(cleanedResult)}
                    emptyLabel={running ? t("ai.running") : t("ai.emptyResult")}
                    unchangedLabel={t("ai.diffUnchanged")}
                    className="h-[52vh] min-h-64 rounded-md border border-input bg-card/60 px-3 py-2 font-mono text-xs leading-6 shadow-xs"
                  />
                </TabsContent>

                <TabsContent value="edit" className="flex min-h-0 flex-col">
                  <div className="relative min-h-0 flex-1">
                    <Textarea
                      value={result}
                      onChange={(event) => setResult(event.target.value)}
                      readOnly={running}
                      aria-label={t("ai.result")}
                      className="h-[52vh] min-h-64 resize-none overflow-y-auto font-mono text-xs leading-6"
                      placeholder={running ? t("ai.running") : t("ai.emptyResult")}
                    />
                    {running && !result ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t("ai.running")}
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <div className="flex gap-2">
              {running ? (
                <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square />
                  {t("ai.stop")}
                </Button>
              ) : (
                <Button variant="outline" onClick={close}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {pending ? (
                <Button onClick={() => action && void start(action)}>
                  {actionMeta ? <actionMeta.icon /> : null}
                  {t("ai.startAction")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={running || !result.trim()}
                    onClick={() => void copy()}
                  >
                    <Copy />
                    {t("ai.copyResult")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={running || !action}
                    onClick={() => action && void start(action, original)}
                  >
                    <RefreshCw />
                    {t("ai.regenerate")}
                  </Button>
                  <Button disabled={running || !result.trim()} onClick={apply}>
                    <Replace />
                    {t("ai.replaceDocument")}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
