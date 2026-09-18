import { IDBDatabase as FakeIDBDatabase, IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetImageDbForTests,
  putImage,
  subscribeImageStorageIssue,
  type ImageRecord,
} from "@/lib/image/db";

function record(id: string): ImageRecord {
  return {
    id,
    data: new ArrayBuffer(1),
    type: "image/png",
    width: 1,
    height: 1,
    createdAt: 1,
  };
}

function controlledRequest(database: IDBDatabase): IDBOpenDBRequest {
  return {
    result: database,
    error: null,
    onblocked: null,
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  } as unknown as IDBOpenDBRequest;
}

function factoryWithFirstRequest(first: IDBOpenDBRequest): IDBFactory {
  const fallback = new IDBFactory();
  let calls = 0;
  return {
    open(name: string, version?: number) {
      calls += 1;
      return calls === 1 ? first : fallback.open(name, version);
    },
  } as IDBFactory;
}

function install(factory: IDBFactory): void {
  Object.defineProperty(globalThis, "indexedDB", {
    value: factory,
    configurable: true,
    writable: true,
  });
}

describe("图片 IndexedDB 连接", () => {
  beforeEach(() => {
    __resetImageDbForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetImageDbForTests();
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("open 被 blocked 后结束本次操作，迟到 success 关闭连接且下次能重试", async () => {
    const close = vi.fn();
    const database = { close, onversionchange: null } as unknown as IDBDatabase;
    const request = controlledRequest(database);
    install(factoryWithFirstRequest(request));
    const issues: Array<string | null> = [];
    subscribeImageStorageIssue((issue) => issues.push(issue));

    const first = putImage(record("first"));
    request.onblocked?.call(request, new Event("blocked") as IDBVersionChangeEvent);

    await expect(first).resolves.toBe(false);
    expect(issues.at(-1)).toBe("unavailable");
    request.onsuccess?.call(request, new Event("success"));
    expect(close).toHaveBeenCalledOnce();
    await expect(putImage(record("second"))).resolves.toBe(true);
    expect(issues.at(-1)).toBeNull();
  });

  it("open 超时后不永久禁用，迟到 success 关闭连接且下次能重试", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const database = { close, onversionchange: null } as unknown as IDBDatabase;
    const request = controlledRequest(database);
    install(factoryWithFirstRequest(request));

    const first = putImage(record("first"));
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(first).resolves.toBe(false);
    request.onsuccess?.call(request, new Event("success"));
    expect(close).toHaveBeenCalledOnce();

    vi.useRealTimers();
    await expect(putImage(record("second"))).resolves.toBe(true);
  });

  it("区分配额耗尽，并在后续写入成功后解除告警", async () => {
    install(new IDBFactory());
    const issues: Array<string | null> = [];
    subscribeImageStorageIssue((issue) => issues.push(issue));
    const original = FakeIDBDatabase.prototype.transaction;
    const transaction = vi
      .spyOn(FakeIDBDatabase.prototype, "transaction")
      .mockImplementation(function (
        this: IDBDatabase,
        storeNames: string | Iterable<string>,
        mode?: IDBTransactionMode,
        options?: IDBTransactionOptions,
      ) {
        if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
        return original.call(this, storeNames, mode, options);
      });

    await expect(putImage(record("full"))).resolves.toBe(false);
    expect(issues.at(-1)).toBe("quota");

    transaction.mockRestore();
    await expect(putImage(record("retry"))).resolves.toBe(true);
    expect(issues.at(-1)).toBeNull();
  });
});
