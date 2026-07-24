"use client";

import { ArrowUpRight, FileCode2, Type } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { MarkdownEditor, type EditorApi, type EditorSelectionInfo } from "@/components/editor/markdown-editor";
import { QuotaWarningBanner } from "@/components/common/quota-warning-banner";
import { useDocument } from "@/components/providers/document-provider";
import { usePrefs } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditorPane } from "@/components/workbench/editor-pane";
import {
  MarkdownPreview,
  type MarkdownPreviewHandle,
} from "@/components/workbench/markdown-preview";
import {
  SettingsDialog,
  type SettingsSection,
} from "@/components/workbench/settings-dialog";
import { SplitPane } from "@/components/workbench/split-pane";
import { StatusBar } from "@/components/workbench/status-bar";
import { TopBar } from "@/components/workbench/top-bar";
import { WechatPreview, type WechatSettingsTarget, type WechatWorkspaceTab } from "@/components/workbench/wechat-preview";
import { WechatPreviewStatus } from "@/components/workbench/wechat-preview-status";
import { WechatWorkspace } from "@/components/workbench/wechat-workspace";
import { XhsPreview, type XhsPreviewHandle } from "@/components/workbench/xhs-preview";
import { XhsPageStatus } from "@/components/workbench/xhs-page-status";
import { XhsWorkspace, type XhsWorkspaceTab } from "@/components/workbench/xhs-workspace";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  downloadPagesAsZip,
  exportPages,
  findBrokenImages,
  pageFilename,
  renderPageToBlob,
} from "@/lib/export/png";
import { baseName, downloadBlob, downloadText, hasAcceptedExtension } from "@/lib/file";
import { PLATFORM_INPUT_LIMITS } from "@/lib/constants";
import { renderMarkdown } from "@/lib/markdown/parse";
import {
  countEditorInput,
  countPreviewContent,
  countText,
  estimateReadingMinutes,
} from "@/lib/markdown/stats";
import {
  DEFAULT_XHS_METADATA,
  parseXhsMarkdown,
  stringifyXhsMarkdown,
  type XhsMetadata,
} from "@/lib/markdown/xhs-frontmatter";
import {
  buildWechatDocument,
  renderWechat,
  type WechatCompatibilityIssue,
} from "@/lib/render/wechat";
import { xhsPalette } from "@/lib/render/xhs";
import { getExportSize, getXhsCanvasSize } from "@/lib/themes/xhs";
import { DEFAULT_RATIOS, type PlatformEditorMode, type ViewId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 预览更新防抖：输入停下来之后再解析（PRD FT-EDT-003 / 12.1）。 */
const PREVIEW_DEBOUNCE_MS = 180;
const LONG_IMAGE_SCALE = 2;
const MAX_LONG_IMAGE_DIMENSION = 32_000;
const XHS_CREATOR_URL = "https://creator.xiaohongshu.com/";
const WECHAT_EDITOR_URL = "https://mp.weixin.qq.com/";

export function Workbench() {
  const { t, lastView, setLastView, ratios, setRatio, hydrated } = usePrefs();
  const { content, filename, autoSavePending, setContent, pending, resolvePending, openFile } = useDocument();
  const { xhs, wechat, setWechat } = useStyles();
  const { profile } = useUserProfile();
  const editorRef = React.useRef<EditorApi>(null);
  const markdownPreviewRef = React.useRef<MarkdownPreviewHandle>(null);
  const xhsRef = React.useRef<XhsPreviewHandle>(null);

  const [narrow, setNarrow] = React.useState(false);
  const [narrowSide, setNarrowSide] = React.useState<"preview" | "editor">("editor");
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [settingsSection, setSettingsSection] =
    React.useState<SettingsSection>("appearance");
  const [xhsTab, setXhsTab] = React.useState<XhsWorkspaceTab>("image");
  const [xhsScrollTarget, setXhsScrollTarget] = React.useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [wechatTab, setWechatTab] = React.useState<WechatWorkspaceTab>("content");
  const [wechatScrollTarget, setWechatScrollTarget] = React.useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [platformModes, setPlatformModes] = React.useState<
    Record<"xhs" | "wechat", PlatformEditorMode>
  >({ xhs: "text", wechat: "text" });
  const [cursor, setCursor] = React.useState<EditorSelectionInfo>({
    line: 1,
    col: 1,
    selectionLength: 0,
  });
  const [pageInfo, setPageInfo] = React.useState({ total: 0, overflowPages: [] as number[] });
  const [exporting, setExporting] = React.useState<{ current: number; total: number } | null>(null);
  const [exportingLongImage, setExportingLongImage] = React.useState(false);
  const [xhsFailedImages, setXhsFailedImages] = React.useState<string[]>([]);
  const [wechatFailedImages, setWechatFailedImages] = React.useState<string[]>([]);
  const [dragging, setDragging] = React.useState(false);

  // 视图直接以 prefs 为准，刷新后自然回到上次所在视图（PRD FT-DOC-004）。
  const view = lastView;
  const parsedDocument = React.useMemo(() => parseXhsMarkdown(content), [content]);
  const imageContent = parsedDocument.body;
  const xhsMetadata = parsedDocument.xhs ?? DEFAULT_XHS_METADATA;
  const debounced = useDebouncedValue(imageContent, PREVIEW_DEBOUNCE_MS);

  const setImageContent = React.useCallback(
    (body: string) =>
      setContent(stringifyXhsMarkdown(body, parsedDocument.xhs, parsedDocument.otherData)),
    [parsedDocument.otherData, parsedDocument.xhs, setContent],
  );

  const setXhsMetadata = React.useCallback(
    (patch: Partial<XhsMetadata>) =>
      setContent(
        stringifyXhsMarkdown(
          imageContent,
          { ...xhsMetadata, ...patch },
          parsedDocument.otherData,
        ),
      ),
    [imageContent, parsedDocument.otherData, setContent, xhsMetadata],
  );

  // 渲染依赖 DOM（DOMPurify），所以只在客户端接管后执行。
  const rendered = React.useMemo(
    () => (hydrated ? renderMarkdown(debounced) : { html: "", title: null, text: "", images: [] }),
    [debounced, hydrated],
  );

  const stats = React.useMemo(() => countText(rendered.text), [rendered.text]);
  const editorInputStats = React.useMemo(
    () => countEditorInput(imageContent),
    [imageContent],
  );
  const previewContentStats = React.useMemo(
    () => countPreviewContent(rendered.html),
    [rendered.html],
  );
  const readingMinutes = React.useMemo(
    () => estimateReadingMinutes(stats.words),
    [stats.words],
  );
  const xhsCanvas = React.useMemo(() => getXhsCanvasSize(xhs), [xhs]);
  const currentImageSources = React.useMemo(
    () => new Set(rendered.images),
    [rendered.images],
  );
  const xhsFailedImageCount = React.useMemo(
    () => xhsFailedImages.filter((source) => currentImageSources.has(source)).length,
    [currentImageSources, xhsFailedImages],
  );
  const wechatFailedImageCount = React.useMemo(
    () => wechatFailedImages.filter((source) => currentImageSources.has(source)).length,
    [currentImageSources, wechatFailedImages],
  );
  const lineCount = React.useMemo(() => imageContent.split(/\r\n?|\n/).length, [imageContent]);
  const docBase = baseName(filename);

  const wechatResult = React.useMemo(
    () => (view === "wechat" ? renderWechat(rendered.html, wechat, profile) : null),
    [view, rendered.html, wechat, profile],
  );

  const changeView = (next: ViewId) => setLastView(next);
  const locateWechatIssue = React.useCallback(
    (issue: WechatCompatibilityIssue) => {
      setNarrowSide("editor");
      setWechatTab("content");
      window.requestAnimationFrame(() => {
        editorRef.current?.locateText(issue.searchText);
      });
    },
    [],
  );

  const openSettings = React.useCallback((section: SettingsSection = "appearance") => {
    setSettingsSection(section);
    setSettingsDialogOpen(true);
  }, []);
  const openProfileSettings = React.useCallback(
    () => openSettings("profile"),
    [openSettings],
  );
  const openXhsCanvasSettings = React.useCallback(() => {
    setNarrowSide("editor");
    setXhsTab("theme");
    setXhsScrollTarget({ id: "xhs-canvas-settings", nonce: Date.now() });
  }, []);

  const changePlatformMode = (mode: PlatformEditorMode) => {
    if (view === "markdown") return;
    setPlatformModes((current) => ({ ...current, [view]: mode }));
  };

  // 稳定化回调：用 ref 保存最新实现，对外暴露引用不变的包装函数，
  // 让 React.memo 包裹的重型预览组件在无关状态变化时跳过重渲染。
  const exportPngRef = React.useRef<(pageIndex?: number) => Promise<void>>(async () => {});
  const exportLongImageRef = React.useRef<() => Promise<void>>(async () => {});
  const copyRichRef = React.useRef<() => Promise<void>>(async () => {});
  const copyPlainRef = React.useRef<() => Promise<void>>(async () => {});
  const downloadHtmlRef = React.useRef<() => void>(() => {});

  const stableExportPng = React.useCallback((pageIndex?: number) => void exportPngRef.current(pageIndex), []);
  const stableExportLongImage = React.useCallback(() => void exportLongImageRef.current(), []);
  const stableCopyRich = React.useCallback(() => void copyRichRef.current(), []);
  const stableCopyPlain = React.useCallback(() => void copyPlainRef.current(), []);
  const stableDownloadHtml = React.useCallback(() => downloadHtmlRef.current(), []);

  /** Markdown 通用预览长图导出：只截取正文节点，不包含预览 Header。 */
  const handleExportLongImage = async () => {
    const node = markdownPreviewRef.current?.getExportNode();
    if (!node || exportingLongImage) return;

    const outputWidth = Math.ceil(node.scrollWidth * LONG_IMAGE_SCALE);
    const outputHeight = Math.ceil(node.scrollHeight * LONG_IMAGE_SCALE);
    if (outputWidth > MAX_LONG_IMAGE_DIMENSION || outputHeight > MAX_LONG_IMAGE_DIMENSION) {
      toast.error(t("editor.longImageTooLarge"), { duration: 10_000 });
      return;
    }

    const broken = findBrokenImages(node);
    if (broken.length > 0) {
      toast.warning(t("image.exportTaintWarn", { n: new Set(broken).size }), { duration: 8000 });
    }

    setExportingLongImage(true);
    try {
      await document.fonts?.ready;
      const backgroundColor = getComputedStyle(node).backgroundColor;
      const blob = await renderPageToBlob(node, {
        scale: LONG_IMAGE_SCALE,
        backgroundColor,
      });
      if (!blob) throw new Error("PNG blob is empty");
      downloadBlob(blob, `${docBase}-preview.png`);
      toast.success(t("editor.longImageDone"));
    } catch {
      toast.error(t("editor.longImageFailed"), { duration: 8000 });
    } finally {
      setExportingLongImage(false);
    }
  };
  React.useEffect(() => {
    exportLongImageRef.current = handleExportLongImage;
  });

  /** 小红书 PNG 导出（PRD FT-XHS-005）。 */
  const handleExportPng = async (pageIndex?: number) => {
    const allNodes = xhsRef.current?.getPageNodes() ?? [];
    const nodes = pageIndex === undefined ? allNodes : allNodes.slice(pageIndex, pageIndex + 1);
    if (nodes.length === 0) return;

    const broken = nodes.flatMap((node) => findBrokenImages(node));
    if (broken.length > 0) {
      toast.warning(t("image.exportTaintWarn", { n: new Set(broken).size }), { duration: 8000 });
    }

    const size = getExportSize();
    setExporting({ current: 0, total: nodes.length });

    const rawResults = await exportPages(nodes, {
      scale: size.scale,
      backgroundColor: xhsPalette(xhs).background,
      onProgress: (current, total) => setExporting({ current, total }),
    });
    const results = rawResults.map((result) => ({
      ...result,
      index: pageIndex === undefined ? result.index : pageIndex,
    }));

    const failed = results.filter((result) => !result.ok);
    let downloaded = 0;
    try {
      if (pageIndex === undefined) {
        downloaded = await downloadPagesAsZip(results, docBase);
      } else {
        const result = results[0];
        if (result?.ok && result.blob) {
          downloadBlob(result.blob, pageFilename(docBase, result.index));
          downloaded = 1;
        }
      }
    } catch {
      toast.error(
        pageIndex === undefined
          ? t("xhs.exportZipFailed")
          : t("xhs.exportPageFailed", { page: pageIndex + 1 }),
        { duration: 8000 },
      );
    } finally {
      setExporting(null);
    }

    if (downloaded > 0) {
      if (pageIndex === undefined) {
        toast.success(t("xhs.exportZipDone", { n: downloaded }), {
          duration: 5000,
          action: {
            label: (
              <span className="flex items-center gap-1">
                {t("xhs.openCreator")}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </span>
            ),
            onClick: () => window.open(XHS_CREATOR_URL, "_blank", "noopener,noreferrer"),
          },
        });
      } else {
        toast.success(t("xhs.exportDone", { n: downloaded }));
      }
    }
    if (failed.length > 0) {
      toast.error(
        failed.map((result) => t("xhs.exportPageFailed", { page: result.index + 1 })).join("\n"),
        { duration: 10_000 },
      );
    }
  };
  React.useEffect(() => {
    exportPngRef.current = handleExportPng;
  });

  /** 复制到公众号：优先 text/html，失败降级（PRD FT-WX-004）。 */
  const handleCopyRich = async () => {
    if (!wechatResult?.html) return;
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([wechatResult.html], { type: "text/html" }),
        "text/plain": new Blob([wechatResult.plainText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      toast.success(t("wechat.copyRichDone"), {
        duration: 5000,
        action: {
          label: (
            <span className="flex items-center gap-1">
              {t("wechat.openEditor")}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </span>
          ),
          onClick: () => window.open(WECHAT_EDITOR_URL, "_blank", "noopener,noreferrer"),
        },
      });
    } catch {
      toast.error(t("wechat.copyFailed"), { duration: 8000 });
    }
  };
  React.useEffect(() => {
    copyRichRef.current = handleCopyRich;
  });

  const handleCopyPlain = async () => {
    if (!wechatResult) return;
    try {
      await navigator.clipboard.writeText(wechatResult.plainText);
      toast.success(t("wechat.copyPlainDone"));
    } catch {
      toast.error(t("wechat.copyFailed"));
    }
  };
  React.useEffect(() => {
    copyPlainRef.current = handleCopyPlain;
  });

  const handleDownloadHtml = () => {
    if (!wechatResult?.html) return;
    downloadText(
      buildWechatDocument(wechatResult.html, rendered.title ?? docBase),
      `${docBase}-wechat.html`,
      "text/html",
    );
    toast.success(t("wechat.downloadHtmlDone"));
  };
  React.useEffect(() => {
    downloadHtmlRef.current = handleDownloadHtml;
  });

  const activeInputLimits =
    view === "xhs"
      ? PLATFORM_INPUT_LIMITS.xhs
      : view === "wechat"
        ? PLATFORM_INPUT_LIMITS.wechat
        : null;
  const inputLimitReached =
    activeInputLimits !== null &&
    (editorInputStats.words >= activeInputLimits.words ||
      editorInputStats.chars >= activeInputLimits.chars);
  const standardEditorNode = (
    <EditorPane editorRef={editorRef} savePending={autoSavePending}>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <MarkdownEditor
            ref={editorRef}
            value={imageContent}
            onChange={setImageContent}
            onSelectionChange={setCursor}
            placeholder={t("editor.placeholder")}
            resetKey={filename}
            ariaLabel={t("a11y.editorRegion")}
          />
        </div>
      </div>
    </EditorPane>
  );

  const editorNode =
    view === "xhs" ? (
      <XhsWorkspace
        activeTab={xhsTab}
        onActiveTabChange={setXhsTab}
        contentMode={platformModes.xhs}
        onContentModeChange={changePlatformMode}
        editorRef={editorRef}
        content={imageContent}
        onContentChange={setImageContent}
        metadata={xhsMetadata}
        onMetadataChange={setXhsMetadata}
        onSelectionChange={setCursor}
        resetKey={filename}
        savePending={autoSavePending}
        scrollTarget={xhsScrollTarget}
        onEditProfile={openProfileSettings}
      />
    ) : view === "wechat" ? (
      <WechatWorkspace
        activeTab={wechatTab}
        onActiveTabChange={setWechatTab}
        contentMode={platformModes.wechat}
        onContentModeChange={changePlatformMode}
        editorRef={editorRef}
        content={imageContent}
        onContentChange={setImageContent}
        onSelectionChange={setCursor}
        resetKey={filename}
        savePending={autoSavePending}
        documentTitle={rendered.title ?? ""}
        docBaseName={docBase}
        scrollTarget={wechatScrollTarget}
        onEditProfile={openProfileSettings}
      />
    ) : (
      standardEditorNode
    );

  const previewNode = (
    <div className="flex min-h-0 flex-1 flex-col">
      {view === "markdown" ? (
        <MarkdownPreview
          ref={markdownPreviewRef}
          html={rendered.html}
          exporting={exportingLongImage}
          onExport={stableExportLongImage}
        />
      ) : null}
      {view === "xhs" ? (
        <XhsPreview
          ref={xhsRef}
          html={rendered.html}
          documentTitle={rendered.title ?? ""}
          hasTitle={rendered.title !== null}
          metadata={xhsMetadata}
          style={xhs}
          onPagesChange={setPageInfo}
          onExport={stableExportPng}
          onExportPage={stableExportPng}
          exportDisabled={pageInfo.total === 0 || exporting !== null}
          exporting={exporting !== null}
          onImageFailuresChange={setXhsFailedImages}
          onEditProfile={openProfileSettings}
        />
      ) : null}
      {view === "wechat" ? (
        <WechatPreview
          html={wechatResult?.html ?? ""}
          style={wechat}
          onStyleChange={setWechat}
          onNavigateSettings={(target: WechatSettingsTarget) => {
            setWechatTab(target.tab);
            setWechatScrollTarget({ id: target.sectionId, nonce: Date.now() });
            setNarrowSide("editor");
          }}
          onCopy={stableCopyRich}
          onDownloadHtml={stableDownloadHtml}
          onCopyPlain={stableCopyPlain}
          copyDisabled={!wechatResult?.html}
          plainTextCopyDisabled={!wechatResult?.plainText}
          onImageFailuresChange={setWechatFailedImages}
          onEditProfile={openProfileSettings}
        />
      ) : null}
    </div>
  );

  return (
    <div
      className="ft-workbench flex h-full min-h-0 flex-1 flex-col"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (!file) return;
        if (!hasAcceptedExtension(file.name)) {
          toast.error(t("doc.unsupportedType", { name: file.name }));
          return;
        }
        void openFile(file);
      }}
    >
      <TopBar
        view={view}
        onViewChange={changeView}
        onOpenSettings={() => openSettings("appearance")}
      />

      <QuotaWarningBanner />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
        {narrow ? (
          <div className="flex shrink-0 items-center gap-1 border-b border-dashed border-border px-3 py-1.5">
            <span className="mr-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {t("layout.narrowHint")}
            </span>
            {(["preview", "editor"] as const).map((side) => (
              <Button
                key={side}
                size="sm"
                variant={narrowSide === side ? "default" : "ghost"}
                onClick={() => setNarrowSide(side)}
              >
                {side === "preview" ? <Type /> : <FileCode2 />}
                {side === "preview" ? t("view.preview") : t("view.edit")}
              </Button>
            ))}
          </div>
        ) : null}

        <SplitPane
          preview={
            <>
              {previewNode}
              {view === "xhs" ? (
                <XhsPageStatus
                  total={pageInfo.total}
                  ratio={xhs.aspectRatio === "custom" ? t("xhs.canvasCustom") : xhs.aspectRatio}
                  width={xhsCanvas.width}
                  height={xhsCanvas.height}
                  onOpenCanvasSettings={openXhsCanvasSettings}
                  overflowPages={pageInfo.overflowPages}
                  failedImages={xhsFailedImageCount}
                  exporting={exporting}
                />
              ) : view === "wechat" ? (
                <WechatPreviewStatus
                  images={previewContentStats.images}
                  subheadings={previewContentStats.subheadings}
                  readingMinutes={readingMinutes}
                  remoteImages={previewContentStats.remoteImages}
                  failedImages={wechatFailedImageCount}
                  warnings={wechatResult?.warnings}
                  issues={wechatResult?.issues}
                  hasContent={Boolean(wechatResult?.html)}
                  onLocateIssue={locateWechatIssue}
                />
              ) : null}
            </>
          }
          editor={
            <>
              {editorNode}
              <StatusBar
                words={stats.words}
                chars={stats.chars}
                lines={lineCount}
                line={cursor.line}
                col={cursor.col}
                selectionLength={cursor.selectionLength}
                limitStatus={
                  activeInputLimits ? (
                    <span className={cn(inputLimitReached && "font-medium text-destructive")}>
                      {t("status.inputLimit", {
                        words: editorInputStats.words,
                        maxWords: activeInputLimits.words,
                        chars: editorInputStats.chars,
                        maxChars: activeInputLimits.chars,
                      })}
                    </span>
                  ) : null
                }
              />
            </>
          }
          ratio={ratios[view]}
          defaultRatio={DEFAULT_RATIOS[view]}
          onRatioCommit={(next) => setRatio(view, next)}
          narrowSide={narrowSide}
          onNarrowChange={setNarrow}
          previewLabel={t("a11y.previewRegion")}
          editorLabel={t("a11y.editorRegion")}
        />
      </main>

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <p className="rounded-lg border-2 border-dashed border-foreground px-8 py-6 text-sm font-medium">
            {t("doc.dropActive")}
          </p>
        </div>
      ) : null}

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        initialSection={settingsSection}
      />

      {/* 未保存变更保护（PRD FT-DOC-005） */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && resolvePending("cancel")}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogHeader>
            <DialogTitle>{t("doc.confirmReplaceTitle")}</DialogTitle>
            <DialogDescription>
              {t("doc.confirmReplaceBody", { name: filename })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => resolvePending("cancel")}>
              {t("common.cancel")}
            </Button>
            <Button variant="outline" onClick={() => resolvePending("discard")}>
              {t("doc.confirmReplaceDiscard")}
            </Button>
            <Button onClick={() => resolvePending("download")}>
              {t("doc.confirmReplaceSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
