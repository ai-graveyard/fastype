import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSnapshot,
  isMajorReplacement,
  parseHistory,
  readHistory,
  saveSnapshot,
} from "@/lib/storage/history";
import { isQuotaExhausted, StorageKey, writeRecord } from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});
describe("本地历史版本", () => {
  it("当前草稿空间不足时优先释放历史，再保存正文", () => {
    saveSnapshot({ filename: "x", content: "旧版本", savedAt: 1 });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === StorageKey.draft && this.getItem(StorageKey.history))
        throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    });
    expect(writeRecord(StorageKey.draft, { content: "最新版本" }).ok).toBe(true);
    expect(readHistory()).toEqual([]);
    expect(isQuotaExhausted()).toBe(false);
  });
  it("重复快照去重，最多保留 12 份，拒绝损坏记录", () => {
    let history = readHistory();
    for (let i = 0; i < 20; i++)
      history = addSnapshot(history, { filename: "稿.md", content: `版本${i}`, savedAt: i });
    expect(history).toHaveLength(12);
    expect(addSnapshot(history, { ...history[0], savedAt: 99 })).toBe(history);
    expect(parseHistory([null, { content: "x" }, ...history])).toEqual(history);
  });
  it("刷新后能读回正文和图片引用", () => {
    expect(
      saveSnapshot({
        filename: "稿.md",
        content: "![图](fastype-img:1234567890abcdef)",
        savedAt: 123,
      }),
    ).toBe(true);
    expect(readHistory()[0].content).toContain("fastype-img:1234567890abcdef");
  });
  it("历史配额失败不会阻断当前草稿写入", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === StorageKey.history) throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    });
    expect(saveSnapshot({ filename: "x", content: "保留当前稿", savedAt: 1 })).toBe(false);
    expect(isQuotaExhausted()).toBe(false);
    expect(writeRecord(StorageKey.draft, { content: "最新内容" }).ok).toBe(true);
  });
  it("删除全文和大段替换会留存，逐字输入不会不断产生快照", () => {
    expect(isMajorReplacement("一篇短文", "")).toBe(true);
    expect(isMajorReplacement("a".repeat(300), "不同的新文章")).toBe(true);
    expect(isMajorReplacement("hello world", "hello worlds")).toBe(false);
  });
});
