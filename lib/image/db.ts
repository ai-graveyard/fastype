/**
 * 正文插图的 IndexedDB 仓库。
 *
 * 为什么不继续用 localStorage：它只能存字符串，图片得先 base64（体积 +33%），配额
 * 只有 5 MB 且按 UTF-16 计量，几张图就满；写入还是同步的，几兆的字符串一写就卡手。
 * IndexedDB 可以直接存 Blob，不用 base64，配额是磁盘的一个百分比，而且是异步的。
 *
 * 这里刻意不引第三方 IndexedDB 封装：需要的只有「按 id 存取一张图」，回调转 Promise
 * 的胶水二十行就够了，不值得为它加一个运行时依赖。
 *
 * 所有操作都不抛错。无痕模式、用户禁用存储、配额耗尽都可能让 IndexedDB 直接不可用，
 * 这时候调用方要能安全降级回「data URI 内嵌」那条老路，而不是让编辑器崩掉。
 */

const DB_NAME = "fastype";
const DB_VERSION = 1;
const STORE = "images";
const CREATED_INDEX = "createdAt";

export interface ImageRecord {
  id: string;
  /**
   * 图片本体。
   *
   * 存 ArrayBuffer 而不是 Blob：Blob 能不能进 IndexedDB 要看实现，Safari 早年就在这里
   * 栽过跟头，字节数组则是结构化克隆里最没有歧义的一种。读出来现拼回 Blob 就行。
   */
  data: ArrayBuffer;
  type: string;
  /** 缩放后的像素尺寸；GIF 原样收下时是 0。 */
  width: number;
  height: number;
  createdAt: number;
}

let connection: Promise<IDBDatabase | null> | null = null;
export type ImageStorageIssue = "unavailable" | "quota";
type ImageStorageIssueListener = (issue: ImageStorageIssue | null) => void;
const issueListeners = new Set<ImageStorageIssueListener>();
let writeIssue: ImageStorageIssue | null = null;

export function subscribeImageStorageIssue(listener: ImageStorageIssueListener): () => void {
  issueListeners.add(listener);
  listener(writeIssue);
  return () => issueListeners.delete(listener);
}

function setWriteIssue(issue: ImageStorageIssue | null): void {
  if (writeIssue === issue) return;
  writeIssue = issue;
  for (const listener of issueListeners) listener(issue);
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22;
}

/**
 * 开库最多等这么久。
 *
 * open 是可以一直不给回音的：另一个标签页压着一条待处理的删库请求、浏览器自己卡住，
 * 都会让请求既不 success 也不 error。没有这道兜底，上层等着它的「下载 Markdown」
 * 就会安静地什么都不做——宁可当它不可用，退回内嵌那条老路。
 */
const OPEN_TIMEOUT_MS = 5_000;

function openDatabase(): Promise<IDBDatabase | null> {
  if (connection) return connection;

  const pending = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(database);
    };
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      finish(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains(STORE)) return;
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      // 清理只关心 id 和创建时间，有这个索引就能只翻键、不把图片本体读出来。
      store.createIndex(CREATED_INDEX, "createdAt");
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      /*
       * 别一直攥着连接不放：另一个标签页要升级结构、或者用户从浏览器设置里清站点数据时，
       * 只要还有连接开着，那边就一直卡在 blocked 上。收到通知就撒手，下次用到再开一条。
       */
      database.onversionchange = () => {
        database.close();
        if (connection === pending) connection = null;
      };
      finish(database);
    };
    request.onerror = () => finish(null);
    // 另一个标签页占着旧版本连接时会卡在这里，别让调用方无限等下去。
    request.onblocked = () => finish(null);
    timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
  });
  connection = pending;
  void pending.then((database) => {
    // blocked、超时和瞬时错误只结束这一次尝试；下一次操作必须能够重新开库。
    if (!database && connection === pending) connection = null;
  });

  return pending;
}

/** 有没有 IndexedDB 这条路可走；false 时调用方退回 data URI 内嵌。 */
export function isImageDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 在一个事务里跑一段读写。
 *
 * 写操作等的是 `transaction.complete` 而不是单条请求的 success——请求成功只说明进了
 * 事务，事务提交失败（多半是配额）那一刻数据仍然会没。
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
  fallback: T,
  onFailure?: (issue: ImageStorageIssue) => void,
): Promise<T> {
  const database = await openDatabase();
  if (!database) {
    onFailure?.("unavailable");
    return fallback;
  }
  try {
    const transaction = database.transaction(STORE, mode);
    const settled = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await run(transaction.objectStore(STORE));
    if (mode === "readwrite") await settled;
    return result;
  } catch (error) {
    onFailure?.(isQuotaError(error) ? "quota" : "unavailable");
    return fallback;
  }
}

export async function putImage(record: ImageRecord): Promise<boolean> {
  const ok = await withStore(
    "readwrite",
    async (store) => {
      await toPromise(store.put(record));
      return true;
    },
    false,
    setWriteIssue,
  );
  if (ok) setWriteIssue(null);
  return ok;
}

export interface ImageReadResult {
  ok: boolean;
  record: ImageRecord | null;
}

/** `ok: false` 表示库暂时不可用，不能据此断定图片不存在。 */
export function readImage(id: string): Promise<ImageReadResult> {
  return withStore<ImageReadResult>(
    "readonly",
    async (store) => ({
      ok: true,
      record: (await toPromise<ImageRecord | undefined>(store.get(id))) ?? null,
    }),
    { ok: false, record: null },
  );
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  return (await readImage(id)).record;
}

export function deleteImages(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return Promise.resolve(true);
  return withStore(
    "readwrite",
    async (store) => {
      await Promise.all(ids.map((id) => toPromise(store.delete(id))));
      return true;
    },
    false,
  );
}

export interface ImageStamp {
  id: string;
  createdAt: number;
}

/** 只翻索引里的键，不读图片本体——清理时把几十兆字节全读出来是白费。 */
export function listImageStamps(): Promise<ImageStamp[]> {
  return withStore<ImageStamp[]>(
    "readonly",
    (store) =>
      new Promise((resolve, reject) => {
        const stamps: ImageStamp[] = [];
        const request = store.index(CREATED_INDEX).openKeyCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(stamps);
            return;
          }
          stamps.push({ id: String(cursor.primaryKey), createdAt: Number(cursor.key) });
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      }),
    [],
  );
}

export function clearImages(): Promise<boolean> {
  return withStore(
    "readwrite",
    async (store) => {
      await toPromise(store.clear());
      return true;
    },
    false,
  );
}

/** 仅供测试使用：关掉已有连接，让下一次调用重新开库。 */
export function __resetImageDbForTests(): void {
  const current = connection;
  connection = null;
  writeIssue = null;
  issueListeners.clear();
  void current?.then((database) => database?.close());
}
