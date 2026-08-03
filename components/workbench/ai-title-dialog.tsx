"use client";

import { Copy, Heading, Loader2, RefreshCw, Sparkles, Square } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useAi } from "@/components/providers/ai-provider";
import { useT } from "@/components/providers/prefs-provider";
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
import { runTitleAction } from "@/lib/ai/client";
import {
  buildTitleMessages,
  parseTitleCandidates,
  TITLE_SUGGESTION_COUNT,
  type TitleSource,
} from "@/lib/ai/titles";
import { applyTitleToSource } from "@/lib/markdown/title";

interface AiTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorRef: React.RefObject<EditorApi | null>;
  /**
   * 打开这一刻正文里的一级标题，没有就是 null。
   *
   * 由父组件在点击时读好传进来，而不是在这里渲染期读 editorRef——渲染期读 ref
   * 在并发渲染下不保证读到一致的值。
   */
  currentTitle: string | null;
}

/**
 * 起标题。
 *
 * 一次拿回若干候选摆出来，点哪个用哪个。落笔只动正文里的第一个 H1，别的一个字不改，
 * 所以不像全文改写那样需要先比对原文——用户点下去的那一刻按当时的正文重算。
 */
export function AiTitleDialog({ open, onOpenChange, editorRef, currentTitle }: AiTitleDialogProps) {
  const t = useT();
  const { config, configured, openSettings } = useAi();
  const [source, setSource] = React.useState<TitleSource>("document");
  const [keywords, setKeywords] = React.useState("");
  const [candidates, setCandidates] = React.useState<string[]>([]);
  const [running, setRunning] = React.useState(false);
  /** 打开后还没生成过，用于区分「还没开始」和「生成完但一条都没解析出来」。 */
  const [generated, setGenerated] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  /** 关掉时把上一轮的候选一起清掉，下次打开是干净的。 */
  const close = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setCandidates([]);
    setGenerated(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const generate = React.useCallback(async () => {
    const document = editorRef.current?.getValue() ?? "";
    const content = source === "keywords" ? keywords.trim() : document;

    if (source === "keywords" && !content) {
      toast.warning(t("ai.titlesKeywordsRequired"));
      return;
    }
    if (source === "document" && !content.trim()) {
      toast.warning(t("ai.documentRequired"));
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
    setRunning(true);

    const response = await runTitleAction(
      config,
      buildTitleMessages(config, {
        source,
        content,
        labels: {
          document: t("ai.promptDocument"),
          keywords: t("ai.titlesKeywordsLabel"),
        },
      }),
      controller.signal,
    );

    if (abortRef.current !== controller) return;
    abortRef.current = null;
    setRunning(false);
    setGenerated(true);

    if (response.ok) {
      setCandidates(parseTitleCandidates(response.content, TITLE_SUGGESTION_COUNT));
      return;
    }
    if (response.canceled) return;
    toast.error(t(response.error.messageKey, response.error.params));
    setCandidates([]);
  }, [config, configured, editorRef, keywords, openSettings, source, t]);

  /** 点候选即落笔：按当下的正文重算，只替换第一个 H1。 */
  const apply = (title: string) => {
    const api = editorRef.current;
    if (!api) return;
    api.replaceDocument(applyTitleToSource(api.getValue(), title));
    toast.success(t("ai.titlesApplied"));
    close();
  };

  const copy = async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        closeLabel={t("common.close")}
        className="max-h-[82vh] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto]"
        onEscapeKeyDown={(event) => running && event.preventDefault()}
        onPointerDownOutside={(event) => running && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Heading className="size-4 text-brand-primary" />
            {t("ai.titles")}
          </DialogTitle>
          <DialogDescription>
            {candidates.length ? t("ai.titlesApplyHint") : t("ai.titlesPendingDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Tabs
            value={source}
            onValueChange={(value) => setSource(value as TitleSource)}
            className="gap-2"
          >
            <TabsList>
              <TabsTrigger value="document" disabled={running}>
                {t("ai.titlesFromDocument")}
              </TabsTrigger>
              <TabsTrigger value="keywords" disabled={running}>
                {t("ai.titlesFromKeywords")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="document">
              <p className="text-xs text-muted-foreground">
                {currentTitle
                  ? t("ai.titlesCurrent", { title: currentTitle })
                  : t("ai.titlesNoCurrent")}
              </p>
            </TabsContent>

            <TabsContent value="keywords">
              <Textarea
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                readOnly={running}
                aria-label={t("ai.titlesKeywordsLabel")}
                placeholder={t("ai.titlesKeywordsPlaceholder")}
                className="min-h-20 text-sm"
                rows={3}
              />
            </TabsContent>
          </Tabs>

          {running ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("ai.titlesRunning")}
            </div>
          ) : candidates.length ? (
            <ul className="flex flex-col gap-1.5">
              {candidates.map((title, index) => (
                <li key={`${index}-${title}`} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => apply(title)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-card/60 px-3 py-2.5 text-left text-sm leading-6 transition-colors hover:border-brand-primary/45 hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    {title}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0 text-muted-foreground"
                    aria-label={t("ai.titlesCopyOne")}
                    title={t("ai.titlesCopyOne")}
                    onClick={() => void copy(title)}
                  >
                    <Copy />
                  </Button>
                </li>
              ))}
            </ul>
          ) : generated ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("ai.titlesEmpty")}</p>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Heading className="size-9 text-muted-foreground/40" />
              <p className="max-w-sm text-sm text-muted-foreground">{t("ai.titlesDescription")}</p>
            </div>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
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
          <Button disabled={running} onClick={() => void generate()}>
            {candidates.length ? <RefreshCw /> : <Sparkles />}
            {candidates.length ? t("ai.titlesRegenerate") : t("ai.titlesGenerate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
