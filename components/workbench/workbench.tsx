"use client";

import { ArrowUpRight, FileCode2, Type } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  MarkdownEditor,
  type EditorApi,
  type EditorSelectionInfo,
} from "@/components/editor/markdown-editor";
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
import { CreatorToolbar } from "@/components/workbench/creator-toolbar";
import { PublishDialog } from "@/components/workbench/publish-dialog";
import {
  ExportImageReview,
  type ExportImageIssue,
} from "@/components/workbench/export-image-review";
import { documentLayoutStore } from "@/lib/storage/document-layout";
import { layoutBlocks, applyLayoutBreaks } from "@/lib/markdown/layout-anchors";
import { findImageMarkups, stringifyImageMarkup } from "@/lib/markdown/image-markup";
import { encodeImageFile } from "@/lib/image/encode";
import { saveImage, peekImageDataUrl } from "@/lib/image/library";
import { imageRefId } from "@/lib/image/ref";
import { blobToDataUrl } from "@/lib/image/data-url";
import { EditorPane } from "@/components/workbench/editor-pane";
import {
  MarkdownPreview,
  type MarkdownPreviewHandle,
} from "@/components/workbench/markdown-preview";
import { SettingsDialog, type SettingsSection } from "@/components/workbench/settings-dialog";
import { SplitPane } from "@/components/workbench/split-pane";
import { StatusBar } from "@/components/workbench/status-bar";
import { TopBar } from "@/components/workbench/top-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import {
  WechatPreview,
  type WechatSettingsTarget,
  type WechatWorkspaceTab,
} from "@/components/workbench/wechat-preview";
import { WechatPreviewStatus } from "@/components/workbench/wechat-preview-status";
import { WechatWorkspace } from "@/components/workbench/wechat-workspace";
import {
  XhsPreview,
  type XhsPreviewHandle,
  type XhsPreviewMode,
} from "@/components/workbench/xhs-preview";
import { XhsPageStatus } from "@/components/workbench/xhs-page-status";
import { XhsWorkspace, type XhsWorkspaceTab } from "@/components/workbench/xhs-workspace";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResolvedImages } from "@/hooks/use-image-library";
import { useHighlightedHtml } from "@/hooks/use-rich-blocks";
import { useScrollSync } from "@/hooks/use-scroll-sync";
import { buildUsedFontEmbedCss } from "@/lib/export/font-embed";
import {
  downloadPagesAsZip,
  exportPages,
  findUnexportableImages,
  pageFilename,
  renderPageToBlob,
  settleExportImages,
} from "@/lib/export/png";
import { printNode } from "@/lib/export/print";
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
  formatXhsPublishBody,
  DEFAULT_XHS_METADATA,
  parseXhsMarkdown,
  stringifyXhsMarkdown,
  type XhsMetadata,
} from "@/lib/markdown/xhs-frontmatter";
import {
  buildPortableHtml,
  buildPortableNode,
  buildStandaloneDocument,
} from "@/lib/render/portable";
import {
  buildWechatDocument,
  renderWechat,
  type WechatCompatibilityIssue,
} from "@/lib/render/wechat";
import { xhsPalette } from "@/lib/render/xhs";
import { getExportSize, getXhsCanvasSize } from "@/lib/themes/xhs";
import {
  DEFAULT_RATIOS,
  XHS_PHONE_PREVIEW_RATIO,
  type PlatformEditorMode,
  type ViewId,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** 预览更新防抖：输入停下来之后再解析（PRD FT-EDT-003 / 12.1）。 */
const PREVIEW_DEBOUNCE_MS = 180;
const LONG_IMAGE_SCALE = 2;
const MAX_LONG_IMAGE_DIMENSION = 32_000;
const XHS_CREATOR_URL = "https://creator.xiaohongshu.com/";
const WECHAT_EDITOR_URL = "https://mp.weixin.qq.com/";

export async function writeWechatClipboard(
  html: string,
  plainText: string,
): Promise<"rich" | "plain"> {
  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return "rich";
    } catch {
      // 富文本剪贴板在 Safari 等环境里可能存在 API 但拒绝写入，继续降级为纯文本。
    }
  }

  await navigator.clipboard.writeText(plainText);
  return "plain";
}

export function Workbench() {
  const { t, lastView, setLastView, ratios, setRatio, hydrated, platformModes, setPlatformMode } =
    usePrefs();
  const {
    content,
    filename,
    autoSavePending,
    setContent,
    pending,
    resolvePending,
    openFile,
    checkpoint,
  } = useDocument();
  const { xhs, wechat, setWechat } = useStyles();
  const { profile } = useUserProfile();
  const editorRef = React.useRef<EditorApi>(null);
  const markdownPreviewRef = React.useRef<MarkdownPreviewHandle>(null);
  const xhsRef = React.useRef<XhsPreviewHandle>(null);

  const layout = React.useSyncExternalStore(
    documentLayoutStore.subscribe,
    documentLayoutStore.getSnapshot,
    documentLayoutStore.getServerSnapshot,
  );
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [imageIssues, setImageIssues] = React.useState<ExportImageIssue[] | null>(null);
  const reviewResolve = React.useRef<((proceed: boolean) => void) | null>(null);
  const exportBusy = React.useRef(false);
  const currentContent = React.useRef(content);
  React.useEffect(() => {
    currentContent.current = content;
  }, [content]);
  React.useEffect(
    () => () => {
      reviewResolve.current?.(false);
    },
    [],
  );
  const [narrow, setNarrow] = React.useState(false);
  const [narrowSide, setNarrowSide] = React.useState<"preview" | "editor">("editor");
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [settingsSection, setSettingsSection] = React.useState<SettingsSection>("appearance");
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
        stringifyXhsMarkdown(imageContent, { ...xhsMetadata, ...patch }, parsedDocument.otherData),
      ),
    [imageContent, parsedDocument.otherData, setContent, xhsMetadata],
  );

  // 正文里的图片是指向 IndexedDB 的引用，渲染前换成 data URI（hooks/use-image-library.ts）。
  const resolved = useResolvedImages(debounced);
  // 渲染依赖 DOM（DOMPurify），所以只在客户端接管后执行。
  const rendered = React.useMemo(
    () => (hydrated ? renderMarkdown(resolved) : { html: "", title: null, text: "", images: [] }),
    [resolved, hydrated],
  );
  /*
   * 代码高亮在这里一次做完，三个视图共用结果。
   *
   * 不放到各视图的 DOM 上做：公众号要把高亮的 class 换算成内联颜色（微信不认 class），
   * 换算发生在 renderWechat 内部，所以高亮必须赶在喂给它之前完成。
   */
  const highlightedHtml = useHighlightedHtml(rendered.html);
  const paginationBlocks = React.useMemo(
    () => (hydrated ? layoutBlocks(rendered.html, debounced) : []),
    [hydrated, rendered.html, debounced],
  );
  const xhsHtml = React.useMemo(
    () =>
      hydrated
        ? applyLayoutBreaks(highlightedHtml, paginationBlocks, layout.breakBefore)
        : highlightedHtml,
    [hydrated, highlightedHtml, paginationBlocks, layout.breakBefore],
  );

  const stats = React.useMemo(() => countText(rendered.text), [rendered.text]);
  const editorInputStats = React.useMemo(() => countEditorInput(imageContent), [imageContent]);
  const previewContentStats = React.useMemo(
    () => countPreviewContent(rendered.html),
    [rendered.html],
  );
  const readingMinutes = React.useMemo(() => estimateReadingMinutes(stats.words), [stats.words]);
  const xhsCanvas = React.useMemo(() => getXhsCanvasSize(xhs), [xhs]);
  const currentImageSources = React.useMemo(() => new Set(rendered.images), [rendered.images]);
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
    () => (view === "wechat" ? renderWechat(highlightedHtml, wechat, profile) : null),
    [view, highlightedHtml, wechat, profile],
  );
  const wechatArticleDocument = React.useMemo(
    () =>
      wechatResult?.html ? buildWechatDocument(wechatResult.html, rendered.title ?? docBase) : "",
    [docBase, rendered.title, wechatResult],
  );

  // 源码与预览按块级元素的源码行号双向联动（只在 Markdown 视图，平台视图的
  // 预览是分页画布和富文本，没有可对应的行）。
  const getPreviewScrollNode = React.useCallback(
    () => markdownPreviewRef.current?.getScrollNode() ?? null,
    [],
  );
  useScrollSync(editorRef, getPreviewScrollNode, view === "markdown", rendered.html);

  const changeView = (next: ViewId) => setLastView(next);
  const locateWechatIssue = React.useCallback((issue: WechatCompatibilityIssue) => {
    setNarrowSide("editor");
    setWechatTab("content");
    window.requestAnimationFrame(() => {
      editorRef.current?.locateText(issue.searchText);
    });
  }, []);

  const openSettings = React.useCallback((section: SettingsSection = "appearance") => {
    setSettingsSection(section);
    setSettingsDialogOpen(true);
  }, []);
  const openProfileSettings = React.useCallback(() => openSettings("profile"), [openSettings]);
  const openXhsCanvasSettings = React.useCallback(() => {
    setNarrowSide("editor");
    setXhsTab("theme");
    setXhsScrollTarget({ id: "xhs-canvas-settings", nonce: Date.now() });
  }, []);

  const changePlatformMode = (mode: PlatformEditorMode) => {
    if (view === "markdown") return;
    setPlatformMode(view, mode);
  };

  // 稳定化回调：用 ref 保存最新实现，对外暴露引用不变的包装函数，
  // 让 React.memo 包裹的重型预览组件在无关状态变化时跳过重渲染。
  const exportPngRef = React.useRef<(pageIndex?: number) => Promise<void>>(async () => {});
  const exportLongImageRef = React.useRef<() => Promise<void>>(async () => {});
  const copyRichRef = React.useRef<() => Promise<void>>(async () => {});
  const copyPlainRef = React.useRef<() => Promise<void>>(async () => {});
  const downloadHtmlRef = React.useRef<() => void>(() => {});
  const copyPreviewStyledRef = React.useRef<() => Promise<void>>(async () => {});
  const exportPreviewHtmlRef = React.useRef<() => void>(() => {});
  const printPreviewRef = React.useRef<() => void>(() => {});

  // 「导出全部」和「导出当前页」拆成两个回调：共用一个可选参数的函数，
  // 一旦被直接挂到 onClick 上就会把事件对象当成页码传进去。
  const stableExportAll = React.useCallback(() => void exportPngRef.current(), []);
  const stableExportPage = React.useCallback(
    (pageIndex: number) => void exportPngRef.current(pageIndex),
    [],
  );
  const stableExportLongImage = React.useCallback(() => void exportLongImageRef.current(), []);
  const stableCopyPreviewStyled = React.useCallback(() => void copyPreviewStyledRef.current(), []);
  const stableExportPreviewHtml = React.useCallback(() => exportPreviewHtmlRef.current(), []);
  const stablePrintPreview = React.useCallback(() => printPreviewRef.current(), []);
  const stableCopyRich = React.useCallback(() => void copyRichRef.current(), []);
  const stableCopyPlain = React.useCallback(() => void copyPlainRef.current(), []);
  const stableDownloadHtml = React.useCallback(() => downloadHtmlRef.current(), []);

  /** 全图预览要横着铺卡片，左侧占 2/3；回到手机预览再还原成左窄右宽。 */
  const [xhsPreviewMode, setXhsPreviewMode] = React.useState<XhsPreviewMode>("grid");
  const xhsRatio = xhsPreviewMode === "grid" ? DEFAULT_RATIOS.xhs : XHS_PHONE_PREVIEW_RATIO;
  const xhsPreviewModeRef = React.useRef<(mode: XhsPreviewMode) => void>(() => {});
  React.useEffect(() => {
    xhsPreviewModeRef.current = (mode) => {
      // 全文和首页之间来回切不该覆盖用户自己拖过的宽度，只有进出全图才改比例。
      if ((xhsPreviewMode === "grid") !== (mode === "grid")) {
        setRatio("xhs", mode === "grid" ? DEFAULT_RATIOS.xhs : XHS_PHONE_PREVIEW_RATIO);
      }
      setXhsPreviewMode(mode);
    };
  });
  const stableXhsPreviewMode = React.useCallback(
    (mode: XhsPreviewMode) => xhsPreviewModeRef.current(mode),
    [],
  );

  const resolveImageReview = (proceed: boolean) => {
    reviewResolve.current?.(proceed);
    reviewResolve.current = null;
    setImageIssues(null);
  };
  const requestImageApproval = async (nodes: HTMLElement[], pageOffset = 0) => {
    await settleExportImages(nodes);
    const missing = await findUnexportableImages(nodes, true);
    if (!missing.length) return true;
    setImageIssues(
      missing.map((src) => ({
        src,
        pages: nodes.flatMap((node, index) =>
          Array.from(node.querySelectorAll("img")).some((img) => img.getAttribute("src") === src)
            ? [index + 1 + pageOffset]
            : [],
        ),
      })),
    );
    return new Promise<boolean>((resolve) => {
      reviewResolve.current = resolve;
    });
  };
  const matchingImage = (source: string, src: string) =>
    findImageMarkups(source).filter((item) => {
      const id = imageRefId(item.src);
      return item.src === src || (id && peekImageDataUrl(id) === src);
    });
  const replaceExportImage = async (src: string, file: File) => {
    const initial = currentContent.current;
    const images = matchingImage(initial, src);
    if (!images.length) {
      toast.error(t("creator.imageLocateFailed"));
      return false;
    }
    try {
      const result = await encodeImageFile(file);
      if (!result.ok) throw new Error("image");
      const ref =
        (await saveImage(result.blob, result.width, result.height)) ??
        (await blobToDataUrl(result.blob));
      if (currentContent.current !== initial) {
        toast.error(t("creator.imageChanged"));
        return false;
      }
      let next = initial;
      for (const item of [...images].reverse())
        next =
          next.slice(0, item.from) +
          stringifyImageMarkup({ ...item, src: ref }) +
          next.slice(item.to);
      setContent(next);
      toast.success(t("creator.imageReplaced"));
      return true;
    } catch {
      toast.error(t("creator.imageReplaceFailed"));
      return false;
    }
  };
  const locateExportImage = (src: string) => {
    const item = matchingImage(imageContent, src)[0];
    if (!item) {
      toast.error(t("creator.imageLocateFailed"));
      return;
    }
    setPublishOpen(false);
    setXhsTab("image");
    setWechatTab("content");
    setNarrowSide("editor");
    requestAnimationFrame(() =>
      editorRef.current?.locateText(imageContent.slice(item.from, item.to)),
    );
  };
  const openPublish = () => {
    setNarrowSide("preview");
    setPublishOpen(true);
  };

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

    if (exportBusy.current) return;
    exportBusy.current = true;
    setExportingLongImage(true);
    const initial = currentContent.current;
    try {
      if (!(await requestImageApproval([node])) || initial !== currentContent.current) return;
      await document.fonts?.ready;
      const backgroundColor = getComputedStyle(node).backgroundColor;
      const blob = await renderPageToBlob(node, {
        scale: LONG_IMAGE_SCALE,
        backgroundColor,
        // 用到自托管字体（行楷）时把那几个分片内联进去，否则长图会退回默认字体。
        fontEmbedCSS: await buildUsedFontEmbedCss(),
      });
      if (!blob) throw new Error("PNG blob is empty");
      downloadBlob(blob, `${docBase}-preview.png`);
      toast.success(t("editor.longImageDone"));
    } catch {
      toast.error(t("editor.longImageFailed"), { duration: 8000 });
    } finally {
      setExportingLongImage(false);
      exportBusy.current = false;
    }
  };
  React.useEffect(() => {
    exportLongImageRef.current = handleExportLongImage;
  });

  /**
   * 复制带格式的正文：把预览的 computed style 内联进 HTML 后写进剪贴板，
   * 粘到公众号、飞书文档、Word 里都保留排版（对照 FT-WX-004 的公众号复制）。
   */
  const handleCopyPreviewStyled = async () => {
    const node = markdownPreviewRef.current?.getExportNode();
    if (!node) return;
    const { html, plainText } = buildPortableHtml(node);
    try {
      // 不支持 ClipboardItem 的浏览器退回纯文本，至少内容不丢。
      if (typeof ClipboardItem === "undefined") {
        await navigator.clipboard.writeText(plainText);
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      }
      toast.success(t("editor.copyStyledDone"));
    } catch {
      toast.error(t("editor.copyFailed"), { duration: 8000 });
    }
  };
  React.useEffect(() => {
    copyPreviewStyledRef.current = handleCopyPreviewStyled;
  });

  /** 导出单文件 HTML：样式已内联，不依赖任何外部资源。 */
  const handleExportPreviewHtml = () => {
    const node = markdownPreviewRef.current?.getExportNode();
    if (!node) return;
    const { html } = buildPortableHtml(node);
    downloadText(
      buildStandaloneDocument(html, rendered.title ?? docBase),
      `${docBase}.html`,
      "text/html",
    );
    toast.success(t("editor.exportHtmlDone"));
  };
  React.useEffect(() => {
    exportPreviewHtmlRef.current = handleExportPreviewHtml;
  });

  /** 打印 / 存为 PDF：打印的是内联好样式的副本，绕开工作台的分栏与滚动容器。 */
  const handlePrintPreview = () => {
    const node = markdownPreviewRef.current?.getExportNode();
    if (!node) return;
    try {
      printNode(buildPortableNode(node), rendered.title ?? docBase);
      toast.info(t("editor.printHint"));
    } catch {
      toast.error(t("editor.printFailed"), { duration: 8000 });
    }
  };
  React.useEffect(() => {
    printPreviewRef.current = handlePrintPreview;
  });

  /** 小红书 PNG 导出（PRD FT-XHS-005）。 */
  const handleExportPng = async (pageIndex?: number) => {
    const allNodes = xhsRef.current?.getPageNodes() ?? [];
    const nodes = pageIndex === undefined ? allNodes : allNodes.slice(pageIndex, pageIndex + 1);
    if (nodes.length === 0 || exportBusy.current) return;
    exportBusy.current = true;
    const initial = currentContent.current;
    setExporting({ current: 0, total: nodes.length });
    try {
      if (
        !(await requestImageApproval(nodes, pageIndex ?? 0)) ||
        initial !== currentContent.current
      )
        return;
      const rawResults = await exportPages(nodes, {
        scale: getExportSize().scale,
        backgroundColor: xhsPalette(xhs).background,
        onProgress: (current, total) => setExporting({ current, total }),
      });
      const results = rawResults.map((result) => ({
        ...result,
        index: pageIndex === undefined ? result.index : pageIndex,
      }));
      const failed = results.filter((result) => !result.ok);
      let downloaded = 0;
      if (pageIndex === undefined)
        downloaded = await downloadPagesAsZip(results, docBase, {
          title: xhsMetadata.title,
          body: formatXhsPublishBody(xhsMetadata),
        });
      else if (results[0]?.ok && results[0].blob) {
        downloadBlob(results[0].blob, pageFilename(docBase, results[0].index));
        downloaded = 1;
      }
      if (downloaded)
        toast.success(
          t(pageIndex === undefined ? "xhs.exportZipDone" : "xhs.exportDone", { n: downloaded }),
          {
            action: {
              label: t("xhs.openCreator"),
              onClick: () => window.open(XHS_CREATOR_URL, "_blank", "noopener,noreferrer"),
            },
          },
        );
      for (const result of failed)
        toast.error(t("xhs.exportPageFailed", { page: result.index + 1 }));
    } catch {
      toast.error(t("creator.exportFailed"));
    } finally {
      setExporting(null);
      exportBusy.current = false;
    }
  };
  React.useEffect(() => {
    exportPngRef.current = handleExportPng;
  });

  /** 复制到公众号：优先 text/html，失败降级（PRD FT-WX-004）。 */
  const handleCopyRich = async () => {
    if (!wechatResult?.html) return;
    try {
      const copiedAs = await writeWechatClipboard(wechatResult.html, wechatResult.plainText);
      toast.success(
        t(copiedAs === "rich" ? "wechat.copyRichDone" : "wechat.copyPlainDone"),
        copiedAs === "rich"
          ? {
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
            }
          : undefined,
      );
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
    <EditorPane editorRef={editorRef} savePending={autoSavePending} content={imageContent}>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <MarkdownEditor
            ref={editorRef}
            onBeforeReplaceDocument={checkpoint}
            value={imageContent}
            onChange={setImageContent}
            onSelectionChange={setCursor}
            placeholder={t("editor.placeholder")}
            resetKey={filename}
            ariaLabel={t("a11y.editorRegion")}
            imageFailedText={t("image.failed")}
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
        onBeforeReplaceDocument={checkpoint}
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
        onBeforeReplaceDocument={checkpoint}
        onSelectionChange={setCursor}
        resetKey={filename}
        savePending={autoSavePending}
        documentTitle={rendered.title ?? ""}
        docBaseName={docBase}
        articleDocument={wechatArticleDocument}
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
          html={highlightedHtml}
          exporting={exportingLongImage}
          onExport={stableExportLongImage}
          onCopyStyled={stableCopyPreviewStyled}
          onExportHtml={stableExportPreviewHtml}
          onPrint={stablePrintPreview}
        />
      ) : null}
      {view === "xhs" ? (
        <XhsPreview
          ref={xhsRef}
          html={xhsHtml}
          keepHeadings={layout.keepHeadings}
          documentTitle={rendered.title ?? ""}
          hasTitle={rendered.title !== null}
          metadata={xhsMetadata}
          style={xhs}
          onPagesChange={setPageInfo}
          onExport={openPublish}
          onExportPage={stableExportPage}
          exportDisabled={pageInfo.total === 0 || exporting !== null}
          exporting={exporting !== null}
          onImageFailuresChange={setXhsFailedImages}
          onEditProfile={openProfileSettings}
          onPreviewModeChange={stableXhsPreviewMode}
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
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        {t("a11y.skipToContent")}
      </a>
      <TopBar
        view={view}
        onViewChange={changeView}
        onOpenSettings={() => openSettings("appearance")}
      />

      <CreatorToolbar
        view={view}
        onPublish={openPublish}
        onEdit={() => {
          setXhsTab("image");
          setWechatTab("content");
          setNarrowSide("editor");
        }}
        blocks={paginationBlocks}
        layout={layout}
        onLayoutChange={documentLayoutStore.set}
      />
      <QuotaWarningBanner />

      <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
        {narrow ? (
          <div className="flex shrink-0 items-center justify-center border-b border-dashed border-border px-3 py-1.5">
            {/* 单栏切换本身已经自解释，不再需要额外说明文字（避免窄屏下和按钮挤在一起）。 */}
            <Tabs
              value={narrowSide}
              onValueChange={(next) => setNarrowSide(next as "preview" | "editor")}
            >
              <TabsList
                className="h-8 gap-0.5 rounded-lg p-0.5"
                aria-label={t("a11y.narrowSideSwitcher")}
              >
                <TabsTrigger
                  value="preview"
                  className="h-full gap-1.5 rounded-md px-3 py-0 text-xs [&_svg]:size-3.5"
                >
                  <Type />
                  {t("view.preview")}
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className="h-full gap-1.5 rounded-md px-3 py-0 text-xs [&_svg]:size-3.5"
                >
                  <FileCode2 />
                  {t("view.edit")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        ) : null}

        <SplitPane
          preview={
            narrow && narrowSide === "editor" ? null : (
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
            )
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
          defaultRatio={view === "xhs" ? xhsRatio : DEFAULT_RATIOS[view]}
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

      {view !== "markdown" ? (
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          platform={view}
          metadata={xhsMetadata}
          onMetadataChange={setXhsMetadata}
          source={imageContent}
          total={pageInfo.total}
          overflowPages={pageInfo.overflowPages}
          failedImages={view === "xhs" ? xhsFailedImageCount : wechatFailedImageCount}
          exporting={exporting !== null}
          onExport={stableExportAll}
          onCopyWechat={stableCopyRich}
          onDownloadHtml={stableDownloadHtml}
          articleDocument={wechatArticleDocument}
          title={rendered.title ?? ""}
          docBase={docBase}
          issues={wechatResult?.issues ?? []}
          onLocateIssue={locateWechatIssue}
        />
      ) : null}
      <ExportImageReview
        issues={imageIssues}
        onResolve={resolveImageReview}
        onReplace={replaceExportImage}
        onLocate={locateExportImage}
      />

      {/* 未保存变更保护（PRD FT-DOC-005） */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && resolvePending("cancel")}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogHeader>
            <DialogTitle>{t("doc.confirmReplaceTitle")}</DialogTitle>
            <DialogDescription>{t("doc.confirmReplaceBody", { name: filename })}</DialogDescription>
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
