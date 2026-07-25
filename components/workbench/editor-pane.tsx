"use client";

import {
  Bold,
  ClipboardType,
  Code,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EditorSearchReplacePopover } from "@/components/editor/editor-search-replace-popover";
import {
  AiQuickActions,
  type AiQuickActionPlatform,
} from "@/components/workbench/ai-quick-actions";
import { AiSelectionPopover } from "@/components/workbench/ai-selection-popover";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { EditorApi } from "@/components/editor/markdown-editor";
import type { TKey } from "@/lib/i18n";
import { markdownToPlainText } from "@/lib/markdown/plain-text";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: TKey;
  run: (api: EditorApi, t: (key: TKey) => string) => void;
}

/**
 * 顺序与 Lovtype 的 Markdown 源码工具栏保持一致；末尾补上 Fastype 已支持的
 * 行内代码、任务列表、链接和表格，避免迁移时倒退已有能力。
 */
const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Bold, labelKey: "editor.bold", run: (api) => api.toggleWrap("**") },
  { icon: Italic, labelKey: "editor.italic", run: (api) => api.toggleWrap("*") },
  { icon: Strikethrough, labelKey: "editor.strike", run: (api) => api.toggleWrap("~~") },
  { icon: Heading1, labelKey: "editor.heading1", run: (api) => api.toggleLinePrefix("# ") },
  { icon: Heading2, labelKey: "editor.heading2", run: (api) => api.toggleLinePrefix("## ") },
  { icon: Heading3, labelKey: "editor.heading3", run: (api) => api.toggleLinePrefix("### ") },
  { icon: List, labelKey: "editor.ul", run: (api) => api.toggleLinePrefix("- ") },
  { icon: ListOrdered, labelKey: "editor.ol", run: (api) => api.toggleLinePrefix("1. ", true) },
  { icon: Quote, labelKey: "editor.quote", run: (api) => api.toggleLinePrefix("> ") },
  {
    icon: SquareCode,
    labelKey: "editor.codeBlock",
    run: (api) => {
      const { text } = api.getSelection();
      api.insertBlock(`\`\`\`\n${text}\n\`\`\``);
    },
  },
  { icon: Minus, labelKey: "editor.hr", run: (api) => api.insertBlock("---") },
  {
    icon: ImageIcon,
    labelKey: "editor.image",
    run: (api, t) => {
      const { text } = api.getSelection();
      api.replaceSelection(`![${text || t("editor.imageAlt")}](https://)`);
    },
  },
  { icon: Code, labelKey: "editor.inlineCode", run: (api) => api.toggleWrap("`") },
  { icon: ListChecks, labelKey: "editor.task", run: (api) => api.toggleLinePrefix("- [ ] ") },
  {
    icon: LinkIcon,
    labelKey: "editor.link",
    run: (api, t) => {
      const { text } = api.getSelection();
      api.replaceSelection(`[${text || t("editor.linkText")}](https://)`);
    },
  },
  {
    icon: TableIcon,
    labelKey: "editor.table",
    run: (api) => api.insertBlock("| A | B |\n| --- | --- |\n|  |  |"),
  },
];

interface EditorPaneProps {
  editorRef: React.RefObject<EditorApi | null>;
  children: React.ReactNode;
  /** 当前编辑还没完成这一轮本地自动保存。 */
  savePending: boolean;
  /** 编辑器级附加操作；位于工具栏最右侧。 */
  extraActions?: React.ReactNode;
  /** 敏感词提示词使用的平台语境。 */
  aiPlatform?: AiQuickActionPlatform;
}

export function EditorPane({
  editorRef,
  children,
  savePending,
  extraActions,
  aiPlatform = "common",
}: EditorPaneProps) {
  const t = useT();

  const run = (action: ToolbarAction) => {
    const api = editorRef.current;
    if (!api) return;
    action.run(api, t);
    // 点完按钮焦点回到编辑器，用户可以直接接着打字（PRD FT-EDT-002）。
    api.focus();
  };

  /** 两个按钮都复制整篇（选区复制用 Cmd/Ctrl+C 就够了）；纯文本模式再去掉 Markdown 标记。 */
  const copy = async (plain: boolean) => {
    const api = editorRef.current;
    if (!api) return;

    const source = api.getValue();
    const text = plain ? markdownToPlainText(source) : source;
    if (!text.trim()) {
      toast.error(t("editor.copyEmpty"));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(t(plain ? "editor.copyPlainDone" : "editor.copyAllDone"));
    } catch {
      toast.error(t("editor.copyFailed"), { duration: 8000 });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <div
        role="toolbar"
        aria-label={t("a11y.formatToolbar")}
        className="flex h-[53px] shrink-0 items-center border-b border-dashed border-border bg-background/30 px-4"
      >
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label={t(savePending ? "doc.statusDirty" : "doc.statusSaved")}>
            <span
              role="status"
              tabIndex={0}
              aria-label={t(savePending ? "doc.statusDirty" : "doc.statusSaved")}
              className={cn(
                "flex size-7 items-center justify-center rounded-sm border border-transparent transition-colors [&_svg]:size-4",
                savePending
                  ? "text-orange-500 dark:text-orange-400"
                  : "text-muted-foreground [&_svg]:text-brand-primary",
              )}
            >
              <Save aria-hidden="true" />
            </span>
          </Tooltip>
          <Tooltip label={t("editor.undo")}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              aria-label={t("editor.undo")}
              onClick={() => editorRef.current?.undo()}
            >
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip label={t("editor.redo")}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              aria-label={t("editor.redo")}
              onClick={() => editorRef.current?.redo()}
            >
              <Redo2 />
            </Button>
          </Tooltip>
          <EditorSearchReplacePopover editorRef={editorRef} />
          <Tooltip label={t("editor.copyAll")}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              aria-label={t("editor.copyAll")}
              onClick={() => void copy(false)}
            >
              <Copy />
            </Button>
          </Tooltip>
          <Tooltip label={t("editor.copyPlain")}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm"
              aria-label={t("editor.copyPlain")}
              onClick={() => void copy(true)}
            >
              <ClipboardType />
            </Button>
          </Tooltip>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-1">
            {TOOLBAR_ACTIONS.map((action) => (
              <Tooltip key={action.labelKey} label={t(action.labelKey)}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-sm"
                  aria-label={t(action.labelKey)}
                  onClick={() => run(action)}
                >
                  <action.icon />
                </Button>
              </Tooltip>
            ))}
          </div>
        </div>

        {extraActions ? (
          <>
            <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-border" />
            <div className="flex shrink-0 items-center gap-2 [&>button]:h-7">{extraActions}</div>
          </>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {children}
        <AiQuickActions editorRef={editorRef} platform={aiPlatform} />
        <AiSelectionPopover editorRef={editorRef} />
      </div>
    </div>
  );
}
