"use client";

import {
  ArrowDownToLine,
  Copy,
  Loader2,
  RefreshCw,
  Replace,
  Settings2,
  Shrink,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { EditorApi, EditorSelectionRect } from "@/components/editor/markdown-editor";
import { useAi } from "@/components/providers/ai-provider";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cleanAiOutput, runAction } from "@/lib/ai/client";
import { AI_ACTIONS, type AiAction } from "@/lib/ai/types";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 只发送选区前后各这么多字符，避免整篇文章被送出去（PRD FT-AI-003）。 */
const CONTEXT_CHARS = 400;
/** 浮层与选区之间留的间距。 */
const GAP = 8;
const TOOLBAR_WIDTH = 300;
const PANEL_WIDTH = 420;
const VIEWPORT_MARGIN = 12;

const ACTION_META: Record<
  AiAction,
  { label: TKey; icon: React.ComponentType<{ className?: string }> }
> = {
  polish: { label: "ai.actionPolish", icon: Wand2 },
  expand: { label: "ai.actionExpand", icon: Sparkles },
  condense: { label: "ai.actionCondense", icon: Shrink },
  custom: { label: "ai.actionCustom", icon: Settings2 },
};

/** 生成开始时冻结下来的选区，之后即使用户点开别处也按这份落笔。 */
interface FrozenSelection {
  from: number;
  to: number;
  text: string;
}

function clampLeft(centerX: number, width: number) {
  const half = width / 2;
  const max = window.innerWidth - VIEWPORT_MARGIN - width;
  return Math.max(VIEWPORT_MARGIN, Math.min(max, centerX - half));
}

/** 优先放在选区上方；上方装不下就翻到下方。 */
function placeVertically(rect: EditorSelectionRect, height: number) {
  const above = rect.top - GAP - height;
  if (above >= VIEWPORT_MARGIN) return above;
  const below = rect.bottom + GAP;
  return Math.min(below, window.innerHeight - VIEWPORT_MARGIN - height);
}

interface AiSelectionPopoverProps {
  editorRef: React.RefObject<EditorApi | null>;
}

export function AiSelectionPopover({ editorRef }: AiSelectionPopoverProps) {
  const t = useT();
  const { config, configured, openSettings } = useAi();

  const [rect, setRect] = React.useState<EditorSelectionRect | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [action, setAction] = React.useState<AiAction | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [result, setResult] = React.useState("");
  const [running, setRunning] = React.useState(false);
  /** 选了自定义但还没发起请求，先让用户写指令。 */
  const [composing, setComposing] = React.useState(false);
  const [frozen, setFrozen] = React.useState<FrozenSelection | null>(null);
  /** 面板展开时把位置钉住，生成过程中不跟着选区跳。 */
  const [anchor, setAnchor] = React.useState<EditorSelectionRect | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelOpen = action !== null;

  // 拖选过程中先藏起来，别挡住正在划的那一段。
  React.useEffect(() => {
    const down = (event: PointerEvent) => {
      // 按在浮层自己身上不算拖选。否则浮层会在 mousedown 时卸载，
      // 按钮在 mousedown 和 click 之间消失，click 永远不会触发。
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      setDragging(true);
    };
    const up = () => setDragging(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  React.useEffect(() => {
    const api = editorRef.current;
    if (!api) return;
    const sync = () => setRect(api.getSelectionRect());
    sync();
    const unsubscribe = api.subscribeSelection(sync);
    window.addEventListener("resize", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", sync);
    };
  }, [editorRef]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const close = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAction(null);
    setResult("");
    setRunning(false);
    setComposing(false);
    setFrozen(null);
    setAnchor(null);
  }, []);

  // Esc 关掉浮层，交互上和搜索面板一致。
  React.useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [panelOpen, close]);

  const start = React.useCallback(
    async (nextAction: AiAction, reuse?: FrozenSelection) => {
      const api = editorRef.current;
      if (!api) return;

      const selection = reuse ?? (() => {
        const { text, from, to } = api.getSelection();
        return { text, from, to };
      })();

      if (!selection.text.trim()) {
        toast.warning(t("ai.selectionRequired"));
        api.focus();
        return;
      }
      if (!configured) {
        toast.info(t("ai.configurePrompt"));
        openSettings();
        return;
      }
      if (nextAction === "custom" && !instruction.trim()) {
        toast.warning(t("ai.customPlaceholder"));
        return;
      }

      const context = api.getContextAround(CONTEXT_CHARS);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFrozen(selection);
      setAction(nextAction);
      setResult("");
      setRunning(true);
      setComposing(false);

      const response = await runAction(
        config,
        {
          action: nextAction,
          selection: selection.text,
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

      if (abortRef.current !== controller) return;
      abortRef.current = null;
      setRunning(false);

      if (response.ok) {
        if (!response.content.trim()) toast.warning(t("ai.emptyResult"));
        setResult(response.content);
        return;
      }
      if (response.canceled) {
        setResult(response.content ?? "");
        return;
      }
      // 鉴权、模型名之类的错误不自动重试，直接引导用户改配置（PRD 第 11 节）。
      toast.error(t(response.error.messageKey, response.error.params));
      setResult("");
    },
    [config, configured, editorRef, instruction, openSettings, t],
  );

  /** 点工具栏按钮：自定义先展开写指令，其余直接开跑。 */
  const trigger = (nextAction: AiAction) => {
    const api = editorRef.current;
    if (!api) return;
    const { text, from, to } = api.getSelection();
    if (!text.trim()) {
      toast.warning(t("ai.selectionRequired"));
      return;
    }
    setAnchor(api.getSelectionRect());
    if (nextAction === "custom") {
      setFrozen({ text, from, to });
      setAction("custom");
      setComposing(true);
      setResult("");
      return;
    }
    void start(nextAction, { text, from, to });
  };

  const cleaned = React.useMemo(() => cleanAiOutput(result), [result]);

  /** 结果永远不会自动覆盖正文，必须由用户点击（PRD FT-AI-004）。 */
  const apply = (mode: "replace" | "insert") => {
    const api = editorRef.current;
    if (!api || !cleaned || !frozen) return;
    const ok =
      mode === "replace"
        ? api.replaceRange(frozen.from, frozen.to, cleaned, frozen.text)
        : api.insertAfterRange(frozen.to, cleaned, frozen.text, frozen.from);
    if (!ok) {
      toast.warning(t("ai.selectionChanged"));
      return;
    }
    toast.success(t(mode === "replace" ? "ai.replaced" : "ai.inserted"));
    close();
  };

  const visible = Boolean(rect) && !dragging;
  if (!visible && !panelOpen) return null;

  const position = anchor ?? rect;
  if (!position) return null;

  const centerX = (position.left + position.right) / 2;

  if (!panelOpen) {
    return (
      <div
        ref={containerRef}
        role="toolbar"
        aria-label={t("ai.selectionActions")}
        // 不让点击夺走编辑器焦点，选区才不会在按下按钮时消失。
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "fixed z-40 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1",
          "shadow-lg backdrop-blur-sm",
        )}
        style={{
          top: placeVertically(position, 40),
          left: clampLeft(centerX, TOOLBAR_WIDTH),
        }}
      >
        {AI_ACTIONS.map((item) => {
          const meta = ACTION_META[item];
          return (
            <Button
              key={item}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => trigger(item)}
            >
              <meta.icon className="size-3.5" />
              {t(meta.label)}
            </Button>
          );
        })}
      </div>
    );
  }

  const meta = action ? ACTION_META[action] : null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={meta ? t(meta.label) : t("ai.selectionActions")}
      className={cn(
        "fixed z-40 flex flex-col gap-2 rounded-lg border border-border bg-popover p-3",
        "shadow-xl",
      )}
      style={{
        top: placeVertically(position, 260),
        left: clampLeft(centerX, PANEL_WIDTH),
        width: PANEL_WIDTH,
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {meta ? <meta.icon className="size-4 text-brand-primary" /> : null}
        {meta ? t(meta.label) : null}
        {running ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-6"
          aria-label={t("common.close")}
          onClick={close}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {action === "custom" ? (
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t("ai.customPlaceholder")}
          aria-label={t("ai.actionCustom")}
          className="min-h-[56px] text-sm"
          rows={2}
          autoFocus={composing}
        />
      ) : null}

      {composing ? (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!instruction.trim()}
            onClick={() => frozen && void start("custom", frozen)}
          >
            {t("ai.startAction")}
          </Button>
        </div>
      ) : (
        <>
          <div className="max-h-52 min-h-16 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2.5 text-sm leading-6">
            {cleaned || (running ? "" : t("ai.emptyResult"))}
            {running && !cleaned ? (
              <span className="text-muted-foreground">{t("ai.running")}</span>
            ) : null}
          </div>

          {frozen ? (
            <p className="text-[11px] text-muted-foreground">
              {t("ai.contextNotice", { n: frozen.text.length })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {running ? (
              <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square />
                {t("ai.stop")}
              </Button>
            ) : (
              <>
                <Button size="sm" disabled={!cleaned} onClick={() => apply("replace")}>
                  <Replace />
                  {t("ai.replace")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!cleaned}
                  onClick={() => apply("insert")}
                >
                  <ArrowDownToLine />
                  {t("ai.insertAfter")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!action || !frozen}
                  onClick={() => action && frozen && void start(action, frozen)}
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
                <Button size="sm" variant="ghost" onClick={close}>
                  <Trash2 />
                  {t("ai.discard")}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
