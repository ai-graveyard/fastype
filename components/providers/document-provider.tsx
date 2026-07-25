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
import { getDefaultDraftContent, getDefaultDraftFilename } from "@/lib/markdown/default-content";
import { formatBytes } from "@/lib/markdown/stats";
import { DEFAULT_DRAFT, parseDraft, type Draft } from "@/lib/prefs";
import { onStorageIssue, StorageKey } from "@/lib/storage";
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
const draftStore = createLocalStore(StorageKey.draft, parseDraft, DEFAULT_DRAFT, buildFirstVisitDraft);

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
  downloadMarkdown: () => void;
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
  const { t, locale } = usePrefs();
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
  const pendingAutoSave = React.useRef<{ content: string; filename: string } | null>(null);

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
        const draftResult = draftStore.setQuiet({
          filename: pendingSave.filename,
          content: pendingSave.content,
          savedAt: Date.now(),
        } satisfies Draft);
        setDraftWriteFailed(!draftResult.ok);
        if (draftResult.ok) setAutoSavePending(false);

        // 通过文件选择器打开的文档同时静默写回原文件。
        const handle = handleRef.current;
        if (!handle) return;

        void writeToHandle(handle, pendingSave.content).then((outcome) => {
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
    [t],
  );

  const setContent = React.useCallback(
    (next: string) => {
      const name = filename || defaultName;
      setLocal({ filename: name, content: next });
      scheduleAutoSave(next, name);
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
      setAutoSavePending(false);
      handleRef.current = handle ?? null;
      setPersisted(nextContent);
      setLocal({ filename: nextName, content: nextContent });
      const result = draftStore.setQuiet({
        filename: nextName,
        content: nextContent,
        savedAt: Date.now(),
      } satisfies Draft);
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
      applyDocument(result.name, result.content, result.handle);
    },
    [applyDocument, t],
  );

  const openFileGuarded = React.useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      guard(() => openFile(file, handle));
    },
    [guard, openFile],
  );

  const downloadMarkdown = React.useCallback(() => {
    const name = ensureMarkdownExtension(sanitizeFilename(filename, defaultName));
    downloadText(content, name);
    setPersisted(content);
    setAutoSavePending(false);
    toast.success(t("doc.downloaded"));
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
      if (choice === "download") downloadMarkdown();
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
      draftStore.setQuiet({
        filename: pendingSave.filename,
        content: pendingSave.content,
        savedAt: Date.now(),
      } satisfies Draft);
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
  }, []);

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
