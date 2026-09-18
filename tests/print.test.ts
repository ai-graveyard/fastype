import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRINT_AREA_ID, printNode } from "@/lib/export/print";

describe("打印临时区域", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "print").mockImplementation(() => {});
    document.title = "原标题";
  });

  afterEach(() => {
    document.getElementById(PRINT_AREA_ID)?.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("打印结束后恢复标题并移除临时节点", () => {
    const node = document.createElement("article");
    node.textContent = "正文";

    printNode(node, "文章标题");
    expect(document.title).toBe("文章标题");
    expect(document.getElementById(PRINT_AREA_ID)?.textContent).toBe("正文");

    window.dispatchEvent(new Event("afterprint"));
    expect(document.title).toBe("原标题");
    expect(document.getElementById(PRINT_AREA_ID)).toBeNull();
  });

  it("浏览器不触发 afterprint 时由超时兜底清理", () => {
    printNode(document.createElement("article"), "文章标题");
    vi.advanceTimersByTime(60_000);
    expect(document.title).toBe("原标题");
    expect(document.getElementById(PRINT_AREA_ID)).toBeNull();
  });
});
