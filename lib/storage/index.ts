import { ALL_STORAGE_KEYS, SCHEMA_VERSION } from "./keys";

export * from "./keys";

export type StorageIssue = "unavailable" | "quota" | "corrupted";

export interface ReadResult<T> {
  value: T;
  /** 本地确实存在一条可用记录（区分「首次访问」和「用户存过默认值」）。 */
  found: boolean;
  /** 只有在数据存在但无法使用时才有值，用来触发一次性提示。 */
  issue?: StorageIssue;
}

export interface WriteResult {
  ok: boolean;
  issue?: StorageIssue;
}

interface Envelope {
  v: number;
  data: unknown;
}

type IssueListener = (issue: StorageIssue) => void;

const listeners = new Set<IssueListener>();
/** 配额一旦耗尽就停止继续写入，避免反复抛错并盖掉最后一份可读数据。 */
let quotaExhausted = false;

/** 配额状态订阅：UI 层用来展示持久性警告横幅。 */
type QuotaListener = (exhausted: boolean) => void;
const quotaListeners = new Set<QuotaListener>();
let quotaRetryTimer: ReturnType<typeof setInterval> | null = null;
const QUOTA_RETRY_INTERVAL_MS = 30_000;

export function onStorageIssue(listener: IssueListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeQuotaExhausted(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  listener(quotaExhausted);
  return () => quotaListeners.delete(listener);
}

export function isQuotaExhausted(): boolean {
  return quotaExhausted;
}

function setQuotaExhausted(value: boolean) {
  if (quotaExhausted === value) return;
  quotaExhausted = value;
  for (const listener of quotaListeners) listener(value);
  if (value) startQuotaRetry();
  else stopQuotaRetry();
}

/** 定期尝试写入探测，配额恢复后自动解除阻断。 */
function startQuotaRetry() {
  if (quotaRetryTimer) return;
  quotaRetryTimer = setInterval(() => {
    if (typeof window === "undefined") return;
    try {
      const probe = "fastype:__probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      setQuotaExhausted(false);
    } catch {
      // 仍然耗尽，继续等待下一轮
    }
  }, QUOTA_RETRY_INTERVAL_MS);
}

function stopQuotaRetry() {
  if (quotaRetryTimer) {
    clearInterval(quotaRetryTimer);
    quotaRetryTimer = null;
  }
}

function emit(issue: StorageIssue) {
  for (const listener of listeners) listener(issue);
}

/** 无痕模式等场景下 localStorage 存在但一写就抛，所以要真正写一次来探测。 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "fastype:__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * 按 name / code 鸭子判断，不依赖 `instanceof Error`：
 * DOMException 是否继承 Error 在不同引擎和 jsdom 里并不一致。
 */
function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    // Safari 私密浏览下的历史行为
    code === 22
  );
}

/**
 * 读取一条带版本号的记录。
 * 校验失败、JSON 损坏或版本不认识时都返回 fallback，绝不抛错阻断启动（PRD FT-SET-001）。
 */
export function readRecord<T>(
  key: string,
  parse: (data: unknown) => T | null,
  fallback: T,
): ReadResult<T> {
  if (typeof window === "undefined") return { value: fallback, found: false };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { value: fallback, found: false, issue: "unavailable" };
  }
  if (raw === null) return { value: fallback, found: false };

  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    return { value: fallback, found: false, issue: "corrupted" };
  }
  if (!envelope || typeof envelope !== "object" || typeof envelope.v !== "number") {
    return { value: fallback, found: false, issue: "corrupted" };
  }
  const migrated = migrate(envelope);
  if (migrated === null) return { value: fallback, found: false, issue: "corrupted" };

  try {
    const parsed = parse(migrated);
    if (parsed === null) return { value: fallback, found: false, issue: "corrupted" };
    return { value: parsed, found: true };
  } catch {
    return { value: fallback, found: false, issue: "corrupted" };
  }
}

/** 目前只有 v1；未来加字段时在这里做向前迁移，读到更高版本则放弃该条记录。 */
function migrate(envelope: Envelope): unknown | null {
  if (envelope.v > SCHEMA_VERSION) return null;
  return envelope.data;
}

export function writeRecord(key: string, data: unknown): WriteResult {
  if (typeof window === "undefined") return { ok: false, issue: "unavailable" };
  if (quotaExhausted) return { ok: false, issue: "quota" };
  const envelope: Envelope = { v: SCHEMA_VERSION, data };
  try {
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    if (isQuotaError(error)) {
      setQuotaExhausted(true);
      emit("quota");
      return { ok: false, issue: "quota" };
    }
    emit("unavailable");
    return { ok: false, issue: "unavailable" };
  }
}

export function removeRecord(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    // 删掉东西之后配额可能又够用了，允许后续写入重新尝试。
    setQuotaExhausted(false);
  } catch {
    /* 存储不可用时静默：清除操作失败不影响正在编辑的内容。 */
  }
}

export function clearAllRecords(): void {
  for (const key of ALL_STORAGE_KEYS) removeRecord(key);
}

/** 仅供测试使用：重置模块内的配额状态。 */
export function __resetStorageStateForTests(): void {
  setQuotaExhausted(false);
  listeners.clear();
  quotaListeners.clear();
}
