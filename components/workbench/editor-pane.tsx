"use client";

import {
  Bold,
  ChevronDown,
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
  Loader2,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EditorSearchReplacePopover } from "@/components/editor/editor-search-replace-popover";
import {
  AiQuickActions,
  type AiQuickActionPlatform,
} from "@/components/workbench/ai-quick-actions";
import { AiSelectionPopover } from "@/components/workbench/ai-selection-popover";
import { ImageCropDialog } from "@/components/workbench/image-crop-dialog";
import { ImageToolbar } from "@/components/workbench/image-toolbar";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { EditorApi } from "@/components/editor/markdown-editor";
import { useImageInsert } from "@/hooks/use-image-insert";
import type { TKey } from "@/lib/i18n";
import { ACCEPTED_IMAGE_TYPES, pickImageFiles } from "@/lib/image/encode";
import type { ImageMarkupMatch } from "@/lib/markdown/image-markup";
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
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const { insertFiles, busy: imageBusy } = useImageInsert(editorRef);
  const [imageDragging, setImageDragging] = React.useState(false);
  const [imageMenuOpen, setImageMenuOpen] = React.useState(false);
  const [cropping, setCropping] = React.useState<ImageMarkupMatch | null>(null);

  /** 剪贴板里有图就插图；只有文字时交给 CodeMirror 自己粘。 */
  const handlePaste = (event: React.ClipboardEvent) => {
    const files = pickImageFiles(event.clipboardData?.items ?? null);
    if (files.length === 0) return;
    event.preventDefault();
    void insertFiles(files);
  };

  /*
   * 拖拽只接管图片。拖 .md 进来是「打开文档」，那件事由 Workbench 在更外层处理，
   * 这里不能把它的 drop 事件吃掉。
   */
  const hasDraggedImage = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.items ?? []).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );

  const handleDragOver = (event: React.DragEvent) => {
    if (!hasDraggedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setImageDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // 拖过子元素时也会触发 dragleave，落点还在容器里就不算离开。
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setImageDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    const files = pickImageFiles(event.dataTransfer?.files ?? null);
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setImageDragging(false);
    void insertFiles(files);
  };

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

        {/*
          插图放在滚动区外面。格式按钮那一排在窄一点的窗口里会溢出、要横着滚，
          排在末尾的插图按钮就整个看不见了——而这是个高频操作，不能藏。

          按钮本身拆成「主按钮 + 下拉箭头」，而不是「点图标弹菜单、菜单里再选从本地插入」：
          打开文件选择框得蹭这一次点击的用户激活，中间隔一层菜单，Radix 关菜单、
          还焦点那串动作和 input.click() 抢同一次激活，浏览器就把对话框吞了。
          主按钮直接开文件框，插链接那条用不着激活，留在下拉里。
        */}
        <div className="flex shrink-0 items-center">
          <Tooltip label={t("editor.imageFromFile")}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-sm rounded-r-none"
              aria-label={t("editor.imageFromFile")}
              disabled={imageBusy}
              onClick={() => imageInputRef.current?.click()}
            >
              {imageBusy ? <Loader2 className="animate-spin" /> : <ImageIcon />}
            </Button>
          </Tooltip>
          <DropdownMenu open={imageMenuOpen} onOpenChange={setImageMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 w-4 rounded-sm rounded-l-none px-0"
                aria-label={t("editor.imageMore")}
                title={t("editor.imageMore")}
              >
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                <Upload />
                {t("editor.imageFromFile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const api = editorRef.current;
                  if (!api) return;
                  const { text } = api.getSelection();
                  api.replaceSelection(`![${text || t("editor.imageAlt")}](https://)`);
                  api.focus();
                }}
              >
                <LinkIcon />
                {t("editor.imageFromUrl")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <input
        ref={imageInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(event) => {
          void insertFiles(Array.from(event.target.files ?? []));
          // 清空才能连续两次选同一张图。
          event.target.value = "";
        }}
      />

      <ImageToolbar editorRef={editorRef} onCrop={setCropping} />

      {cropping ? (
        <ImageCropDialog
          src={cropping.src}
          open
          onOpenChange={(next) => !next && setCropping(null)}
          onSave={(dataUrl) => {
            const api = editorRef.current;
            const current = api?.getImageAtCursor();
            if (api && current) api.replaceImage(current, { ...current, src: dataUrl });
            setCropping(null);
          }}
        />
      ) : null}

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {children}
        <AiQuickActions editorRef={editorRef} platform={aiPlatform} />
        <AiSelectionPopover editorRef={editorRef} />
        {imageDragging ? (
          <div className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-brand-primary/60 bg-background/80 text-sm font-medium text-brand-primary backdrop-blur-sm">
            {t("editor.imageDropHint")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
