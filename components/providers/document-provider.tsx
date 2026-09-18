"use client";

import * as React from "react";
import { toast } from "sonner";

import { usePrefs } from "@/components/providers/prefs-provider";
import {
  baseName,
  downloadText,
  ensureMarkdownExtension,
  readTextFile,
  sanitizeFilename,
  writeToHandle,
} from "@/lib/file";
import { detectLocale } from "@/lib/i18n";
import { importDataUrls, inlineImageRefsStrict, sweepUnusedImages } from "@/lib/image/library";
import { getDefaultDraftContent, getDefaultDraftFilename } from "@/lib/markdown/default-content";
import { formatBytes } from "@/lib/image/data-url";
import { DEFAULT_DRAFT, parseDraft, type Draft } from "@/lib/prefs";
import { onStorageIssue, readAllRawRecords, readRecord, StorageKey } from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";

/** 编辑期间每 3 秒自动保存一次，避免每次按键都同步写入存储。 */
const AUTO_SAVE_DELAY_MS = 3_000;
/** 超过这个大小就提醒可能变慢，但不阻止（PRD 第 11 节）。 */
const LARGE_DOC_BYTES = 300 * 1024;

/** 首次访问时（本地没有任何记录）用教程内容代替空白文档（PRD FT-SET-004）。 */
function buildFirstVisitDraft(fallback: Draft): Draft {
  const locale =
    typeof navigator === "undefined"
      ? "zh"
      : detectLocale(navigator.languages ?? [navigator.language]);
  return {
    ...fallback,
    filename: getDefaultDraftFilename(locale),
    content: getDefaultDraftContent(locale),
  };
}

/** 草稿独立成一条记录，清样式或 AI 配置不会误删正文（PRD FT-SET-001）。 */
const draftStore = createLocalStore(
  StorageKey.draft,
  parseDraft,
  DEFAULT_DRAFT,
  buildFirstVisitDraft,
);

interface PendingAction {
  run: () => void | Promise<void>;
}

interface DocumentContextValue {
  filename: string;
  content: string;
  /** 有内容还没写回文件或下载。只存了本地草稿不算已保存（PRD FT-DOC-004）。 */
  dirty: boolean;
  /** 当前编辑内容还没完成这一轮 3 秒本地自动保存。 */
  autoSavePending: boolean;
  setContent: (content: string) => void;
  setFilename: (filename: string) => void;
  newDocument: () => void;
  openFile: (file: File, handle?: FileSystemFileHandle) => Promise<void>;
  downloadMarkdown: () => Promise<boolean>;
  clearDraft: () => void;
  pending: PendingAction | null;
  resolvePending: (choice: "discard" | "download" | "cancel") => void;
}

const DocumentContext = React.createContext<DocumentContextValue | null>(null);

interface LocalDoc {
  filename: string;
  content: string;
}

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { t, locale, hydrated } = usePrefs();
  const defaultName = t("doc.untitled");

  // 首帧读到的本地草稿。useSyncExternalStore 保证服务端渲染用默认值、
  // 客户端接管后立刻拿到真实草稿，不需要「effect 里 setState」那一跳。
  const storedDraft = React.useSyncExternalStore(
    draftStore.subscribe,
    draftStore.getSnapshot,
    draftStore.getServerSnapshot,
  );

  // 用户动过之后由本地状态接管；在那之前直接展示草稿。
  const [local, setLocal] = React.useState<LocalDoc | null>(null);
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [autoSavePending, setAutoSavePending] = React.useState(false);
  /**
   * 本地草稿最后一次写入失败了（配额耗尽、无痕模式等）。
   *
   * 只有这种情况关掉页面才真的会丢内容——正常情况下草稿在 localStorage 里，
   * 刷新回来就在，没必要拿浏览器的「确定要离开吗」去拦一次什么都没丢的关闭。
   */
  const [draftWriteFailed, setDraftWriteFailed] = React.useState(false);

  /**
   * 最后一次真正落盘（写回文件或下载）的内容。
   * 这是状态而不是 ref：dirty 由它算出来，必须能驱动重渲染。
   * 恢复出来的草稿一律视为「未落盘」，所以初值是空串。
   */
  const [persisted, setPersisted] = React.useState("");
  const handleRef = React.useRef<FileSystemFileHandle | null>(null);
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveVersion = React.useRef(0);
  const contentChangeVersion = React.useRef(0);
  const pendingAutoSave = React.useRef<{ content: string; filename: string } | null>(null);
  const lastDraftWriteAt = React.useRef(0);
  const draftRevisionInitialized = React.useRef(false);
  const draftConflictNotified = React.useRef(false);

  const filename = local?.filename ?? storedDraft.filename ?? "";
  const content = local?.content ?? storedDraft.content ?? "";
  const dirty = content !== persisted;

  // 恢复提示是纯副作用，不改状态：状态已经由 store 直接给出了。
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    // 首次访问回填的教程内容不算「恢复」，只有本地确实存过记录才提示。
    if (draftStore.isFound() && storedDraft.content) toast.success(t("doc.restoredDraft"));
  }, [storedDraft.content, t]);

  React.useEffect(() => {
    return onStorageIssue((issue) => {
      if (issue === "quota") toast.error(t("settings.storageQuota"), { duration: 12_000 });
      if (issue === "unavailable") toast.warning(t("settings.storageUnavailable"));
    });
  }, [t]);

  // 异步收尾时要判断正文有没有被改过，靠 ref 拿当下这一份。
  const contentRef = React.useRef(content);
  React.useEffect(() => {
    contentRef.current = content;
  });

  React.useEffect(() => {
    if (!hydrated || draftRevisionInitialized.current) return;
    draftRevisionInitialized.current = true;
    lastDraftWriteAt.current = storedDraft.savedAt;
  }, [hydrated, storedDraft.savedAt]);

  const writeDraftSafely = React.useCallback(
    (draft: Draft) => {
      const current = readRecord(StorageKey.draft, parseDraft, DEFAULT_DRAFT);
      const conflicts =
        draftRevisionInitialized.current &&
        current.found &&
        current.value.savedAt > lastDraftWriteAt.current &&
        current.value.content !== draft.content;
      if (conflicts) {
        if (!draftConflictNotified.current) {
          draftConflictNotified.current = true;
          toast.error(t("doc.externalDraftConflict"), { duration: 12_000 });
        }
        return false;
      }

      const result = draftStore.setQuiet(draft);
      if (result.ok) {
        lastDraftWriteAt.current = draft.savedAt;
        draftConflictNotified.current = false;
      }
      return result.ok;
    },
    [t],
  );

  /**
   * 启动时整理图片库。
   *
   * 两件事：把草稿里内嵌的 base64 搬进 IndexedDB（升级前存下的草稿、刚打开的外部文件、
   * 直接粘进来的一段带图 Markdown 都是这个形态），再删掉正文已经不引用的图片本体。
   *
   * 清理只在启动时做：编辑期间删掉的图还能撤销回来，当场清库会让撤销之后刷新页面就缺图。
   *
   * 必须等 hydrated：水合那一帧 useSyncExternalStore 给的还是服务端快照（空草稿），
   * 这时候动手等于对着一份空正文做迁移，本地那份带图的草稿一个字都没搬到。
   */
  const sweptRef = React.useRef(false);
  React.useEffect(() => {
    if (!hydrated || sweptRef.current) return;
    sweptRef.current = true;
    const initial = contentRef.current;
    const name = filename || defaultName;

    void (async () => {
      const imported = await importDataUrls(initial);
      // 迁移期间用户已经动过正文，就别拿旧内容盖回去；这一批图下次启动会被当作无引用清掉。
      if (imported.content !== initial && contentRef.current === initial) {
        setLocal({ filename: name, content: imported.content });
        writeDraftSafely({
          filename: name,
          content: imported.content,
          savedAt: Date.now(),
        } satisfies Draft);
      }
      /*
       * 清理要连头像和公众号封面一起看：它们的图和正文插图在同一个库里，只按正文扫一遍
       * 就会把它们当成没人要的删掉。读不出本地记录时干脆不清，宁可留着孤儿。
       */
      const stored = readAllRawRecords();
      if (stored) await sweepUnusedImages([contentRef.current, ...stored]);
    })();
  }, [hydrated, defaultName, filename, writeDraftSafely]);

  const cancelAutoSave = React.useCallback(() => {
    autoSaveVersion.current += 1;
    pendingAutoSave.current = null;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  const scheduleAutoSave = React.useCallback(
    (nextContent: string, nextName: string) => {
      setAutoSavePending(true);
      pendingAutoSave.current = { content: nextContent, filename: nextName };
      autoSaveVersion.current += 1;
      if (autoSaveTimer.current) return;

      autoSaveTimer.current = setTimeout(() => {
        autoSaveTimer.current = null;
        const pendingSave = pendingAutoSave.current;
        pendingAutoSave.current = null;
        if (!pendingSave) return;
        const version = autoSaveVersion.current;

        // 本地草稿始终自动保存；不通知订阅者，避免无意义的重渲染。
        const draftSaved = writeDraftSafely({
          filename: pendingSave.filename,
          content: pendingSave.content,
          savedAt: Date.now(),
        } satisfies Draft);
        setDraftWriteFailed(!draftSaved);
        if (draftSaved) setAutoSavePending(false);

        // 通过文件选择器打开的文档同时静默写回原文件。
        const handle = handleRef.current;
        if (!handle) return;

        // 写进磁盘的那一份要把图片引用换回 data URI，文件拷到别处才不会缺图。
        void inlineImageRefsStrict(pendingSave.content).then(async (portable) => {
          if (version !== autoSaveVersion.current || handle !== handleRef.current) return;
          if (portable.unresolvedIds.length > 0) {
            toast.error(t("doc.missingLocalImages", { n: portable.unresolvedIds.length }));
            return;
          }
          const outcome = await writeToHandle(handle, portable.content);
          // 写入期间如果切换了文档或又有新输入，旧结果不再更新当前状态。
          if (version !== autoSaveVersion.current || handle !== handleRef.current) return;
          if (outcome.ok && outcome.wroteToFile) {
            setPersisted(pendingSave.content);
            return;
          }
          if (!outcome.ok && !outcome.canceled) {
            toast.error(t("doc.saveFailed", { reason: outcome.detail }));
          }
        });
      }, AUTO_SAVE_DELAY_MS);
    },
    [t, writeDraftSafely],
  );

  const setContent = React.useCallback(
    (next: string) => {
      const name = filename || defaultName;
      const version = ++contentChangeVersion.current;
      contentRef.current = next;
      setLocal({ filename: name, content: next });
      scheduleAutoSave(next, name);

      if (!next.includes("data:image/")) return;
      void importDataUrls(next).then((imported) => {
        if (
          imported.content === next ||
          version !== contentChangeVersion.current ||
          contentRef.current !== next
        ) {
          return;
        }
        contentRef.current = imported.content;
        setLocal({ filename: name, content: imported.content });
        scheduleAutoSave(imported.content, name);
      });
    },
    [filename, defaultName, scheduleAutoSave],
  );

  const setFilename = React.useCallback(
    (next: string) => {
      const clean = sanitizeFilename(next, defaultName);
      setLocal({ filename: clean, content });
      scheduleAutoSave(content, clean);
    },
    [content, defaultName, scheduleAutoSave],
  );

  /** 有未保存变更时先确认，再执行会替换正文的操作（PRD FT-DOC-005）。 */
  const guard = React.useCallback(
    (run: () => void | Promise<void>) => {
      if (!dirty || !content.trim()) {
        void run();
        return;
      }
      setPending({ run });
    },
    [dirty, content],
  );

  const applyDocument = React.useCallback(
    (nextName: string, nextContent: string, handle?: FileSystemFileHandle) => {
      cancelAutoSave();
      contentChangeVersion.current += 1;
      contentRef.current = nextContent;
      setAutoSavePending(false);
      handleRef.current = handle ?? null;
      setPersisted(nextContent);
      setLocal({ filename: nextName, content: nextContent });
      const result = draftStore.setQuiet({
        filename: nextName,
        content: nextContent,
        savedAt: Date.now(),
      } satisfies Draft);
      if (result.ok) {
        const saved = readRecord(StorageKey.draft, parseDraft, DEFAULT_DRAFT).value;
        lastDraftWriteAt.current = saved.savedAt;
        draftConflictNotified.current = false;
      }
      setDraftWriteFailed(!result.ok);
    },
    [cancelAutoSave],
  );

  const newDocument = React.useCallback(() => {
    guard(() => applyDocument(defaultName, ""));
  }, [guard, applyDocument, defaultName]);

  const openFile = React.useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      const result = await readTextFile(file, handle);
      if (!result.ok) {
        if (result.reason === "unsupportedType") {
          toast.error(t("doc.unsupportedType", { name: result.name }));
        } else if (result.reason === "decodeFailed") {
          toast.error(t("doc.decodeFailed", { name: result.name }));
        } else {
          toast.error(t("doc.readFailed", { reason: result.detail ?? "" }));
        }
        return;
      }
      if (file.size > LARGE_DOC_BYTES) {
        toast.warning(t("doc.tooLarge", { size: formatBytes(file.size) }));
      }
      // 外部文件里的图片是内嵌 base64，先搬进图片库再进编辑器，草稿才存得下。
      const imported = await importDataUrls(result.content);
      applyDocument(result.name, imported.content, result.handle);
    },
    [applyDocument, t],
  );

  const openFileGuarded = React.useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      guard(() => openFile(file, handle));
    },
    [guard, openFile],
  );

  const downloadMarkdown = React.useCallback(async () => {
    const name = ensureMarkdownExtension(sanitizeFilename(filename, defaultName));
    // 下载下来的必须是自包含的一份：图片引用换回 data URI，不依赖本机 IndexedDB。
    const portable = await inlineImageRefsStrict(content);
    if (portable.unresolvedIds.length > 0) {
      toast.error(t("doc.missingLocalImages", { n: portable.unresolvedIds.length }));
      return false;
    }
    downloadText(portable.content, name);
    setPersisted(content);
    setAutoSavePending(false);
    setDraftWriteFailed(false);
    toast.success(t("doc.downloaded"));
    return true;
  }, [content, filename, defaultName, t]);

  /** 清除草稿（单独清除或作为「清除全部」的一部分）后回到教程内容，而不是空白文档。 */
  const clearDraft = React.useCallback(() => {
    cancelAutoSave();
    const next: Draft = {
      filename: getDefaultDraftFilename(locale),
      content: getDefaultDraftContent(locale),
      savedAt: 0,
    };
    draftStore.set(next);
    lastDraftWriteAt.current = next.savedAt;
    draftConflictNotified.current = false;
    contentChangeVersion.current += 1;
    contentRef.current = next.content;
    /*
     * 正文、头像和封面共用一座图片库，同一张图也可能被多处复用。更新草稿后按全部本地记录
     * 统一清扫，不能只凭旧正文里的 id 直接删本体。
     */
    const stored = readAllRawRecords();
    if (stored) void sweepUnusedImages(stored);
    handleRef.current = null;
    setPersisted("");
    setAutoSavePending(false);
    setLocal({ filename: next.filename, content: next.content });
  }, [cancelAutoSave, locale]);

  const resolvePending = React.useCallback(
    (choice: "discard" | "download" | "cancel") => {
      const action = pending;
      setPending(null);
      if (!action || choice === "cancel") return;
      // 下载要等图片引用换回 data URI，换完再执行会替换正文的那件事。
      if (choice === "download") {
        void downloadMarkdown().then((downloaded) => {
          if (downloaded) return action.run();
        });
        return;
      }
      void action.run();
    },
    [pending, downloadMarkdown],
  );

  /**
   * 关闭页面前提醒（浏览器只允许标准提示文案）。
   *
   * 只在草稿存不进 localStorage 时才拦。用 dirty 当条件是不对的：恢复出来的草稿
   * 和首次访问的教程内容一律算「未落盘」，用户一个字都没改也会被拦一次。
   */
  React.useEffect(() => {
    if (!draftWriteFailed) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draftWriteFailed]);

  // 移动端 / PWA 被系统回收时不触发 beforeunload，必须在 visibilitychange / pagehide 紧急落盘。
  React.useEffect(() => {
    const emergencySave = () => {
      const pendingSave = pendingAutoSave.current;
      if (!pendingSave) return;
      pendingAutoSave.current = null;
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      const draftSaved = writeDraftSafely({
        filename: pendingSave.filename,
        content: pendingSave.content,
        savedAt: Date.now(),
      } satisfies Draft);
      setDraftWriteFailed(!draftSaved);
      if (draftSaved) setAutoSavePending(false);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") emergencySave();
    };
    const onPageHide = () => emergencySave();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [writeDraftSafely]);

  React.useEffect(() => cancelAutoSave, [cancelAutoSave]);

  const value = React.useMemo<DocumentContextValue>(
    () => ({
      filename: filename || defaultName,
      content,
      dirty,
      autoSavePending,
      setContent,
      setFilename,
      newDocument,
      openFile: openFileGuarded,
      downloadMarkdown,
      clearDraft,
      pending,
      resolvePending,
    }),
    [
      filename,
      defaultName,
      content,
      dirty,
      autoSavePending,
      setContent,
      setFilename,
      newDocument,
      openFileGuarded,
      downloadMarkdown,
      clearDraft,
      pending,
      resolvePending,
    ],
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocument(): DocumentContextValue {
  const context = React.useContext(DocumentContext);
  if (!context) throw new Error("useDocument must be used inside <DocumentProvider>");
  return context;
}

export { baseName };

/** 仅供测试使用：丢掉草稿的模块级缓存，让下一次渲染重新读 localStorage。 */
export function __resetDraftForTests(): void {
  draftStore.__forgetForTests();
}
