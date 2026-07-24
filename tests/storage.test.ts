import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetStorageStateForTests,
  isStorageAvailable,
  onStorageIssue,
  readRecord,
  removeRecord,
  writeRecord,
} from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";

interface Sample {
  name: string;
}

const FALLBACK: Sample = { name: "default" };

function parseSample(raw: unknown): Sample | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Sample).name;
  return typeof value === "string" ? { name: value } : null;
}

describe("readRecord / writeRecord", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStorageStateForTests();
  });

  it("写进去能原样读回来", () => {
    writeRecord("k", { name: "hi" });
    expect(readRecord("k", parseSample, FALLBACK)).toEqual({
      value: { name: "hi" },
      found: true,
    });
  });

  it("没有记录时返回默认值且 found 为 false", () => {
    const result = readRecord("missing", parseSample, FALLBACK);
    expect(result.value).toBe(FALLBACK);
    expect(result.found).toBe(false);
  });

  it("JSON 损坏时安全降级，不抛错", () => {
    localStorage.setItem("k", "{ 这不是 JSON");
    const result = readRecord("k", parseSample, FALLBACK);
    expect(result.value).toBe(FALLBACK);
    expect(result.issue).toBe("corrupted");
  });

  it("缺少版本号的记录视为损坏", () => {
    localStorage.setItem("k", JSON.stringify({ data: { name: "x" } }));
    expect(readRecord("k", parseSample, FALLBACK).issue).toBe("corrupted");
  });

  it("版本号高于当前实现时放弃该记录而不是硬读", () => {
    localStorage.setItem("k", JSON.stringify({ v: 999, data: { name: "future" } }));
    const result = readRecord("k", parseSample, FALLBACK);
    expect(result.value).toBe(FALLBACK);
    expect(result.issue).toBe("corrupted");
  });

  it("校验不通过时用默认值", () => {
    writeRecord("k", { name: 42 });
    expect(readRecord("k", parseSample, FALLBACK).value).toBe(FALLBACK);
  });

  it("配额写满后停止写入，且不覆盖最后一份可读数据", () => {
    writeRecord("k", { name: "safe" });

    const quotaError = new DOMException("quota", "QuotaExceededError");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError;
    });

    const issues: string[] = [];
    const unsubscribe = onStorageIssue((issue) => issues.push(issue));

    expect(writeRecord("k", { name: "new" }).issue).toBe("quota");
    expect(issues).toContain("quota");

    // 配额耗尽后不再反复尝试写入。
    const callsAfterFirst = setItem.mock.calls.length;
    expect(writeRecord("k", { name: "newer" }).issue).toBe("quota");
    expect(setItem.mock.calls.length).toBe(callsAfterFirst);

    setItem.mockRestore();
    unsubscribe();
    expect(readRecord("k", parseSample, FALLBACK).value).toEqual({ name: "safe" });
  });

  it("localStorage 不可用时读取返回默认值而不是崩溃", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const result = readRecord("k", parseSample, FALLBACK);
    expect(result.value).toBe(FALLBACK);
    expect(result.issue).toBe("unavailable");
    getItem.mockRestore();
  });

  it("探测可用性", () => {
    expect(isStorageAvailable()).toBe(true);
  });

  it("删除后恢复到默认值", () => {
    writeRecord("k", { name: "x" });
    removeRecord("k");
    expect(readRecord("k", parseSample, FALLBACK).found).toBe(false);
  });
});

describe("createLocalStore", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStorageStateForTests();
  });

  it("快照引用稳定，避免 useSyncExternalStore 死循环", () => {
    const store = createLocalStore("s", parseSample, FALLBACK);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("首次访问时可以自定义初值", () => {
    const store = createLocalStore("s", parseSample, FALLBACK, () => ({ name: "detected" }));
    expect(store.getSnapshot()).toEqual({ name: "detected" });
    expect(store.isFound()).toBe(false);
  });

  it("本地已有记录时不走首次访问逻辑", () => {
    writeRecord("s", { name: "stored" });
    const store = createLocalStore("s", parseSample, FALLBACK, () => ({ name: "detected" }));
    expect(store.getSnapshot()).toEqual({ name: "stored" });
  });

  it("set 通知订阅者，setQuiet 不通知", () => {
    const store = createLocalStore("s", parseSample, FALLBACK);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.set({ name: "a" });
    expect(notified).toBe(1);
    expect(store.getSnapshot()).toEqual({ name: "a" });

    store.setQuiet({ name: "b" });
    expect(notified).toBe(1);
    // 静默写入依然更新缓存和本地存储。
    expect(store.getSnapshot()).toEqual({ name: "b" });
    expect(readRecord("s", parseSample, FALLBACK).value).toEqual({ name: "b" });
  });

  it("reset 回到默认值并清掉本地记录", () => {
    const store = createLocalStore("s", parseSample, FALLBACK);
    store.set({ name: "a" });
    store.reset();
    expect(store.getSnapshot()).toBe(FALLBACK);
    expect(localStorage.getItem("s")).toBeNull();
  });

  it("服务端快照恒为默认值", () => {
    const store = createLocalStore("s", parseSample, FALLBACK);
    store.set({ name: "a" });
    expect(store.getServerSnapshot()).toBe(FALLBACK);
  });
});
