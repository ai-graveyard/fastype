import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { __resetImageDbForTests } from "@/lib/image/db";
import { __resetImageCacheForTests, saveImageDataUrl } from "@/lib/image/library";
import { StorageKey } from "@/lib/storage";

function Thrower(): never {
  throw new Error("secret-path/api-key");
}

describe("全局错误恢复", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const redPixel =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();
    __resetImageCacheForTests();
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    __resetImageDbForTests();
    __resetImageCacheForTests();
    vi.restoreAllMocks();
  });

  it("崩溃后仍展示并可复制本地草稿，非开发环境不暴露错误详情", async () => {
    window.localStorage.setItem(
      StorageKey.draft,
      JSON.stringify({ v: 1, data: { filename: "草稿.md", content: "# 未丢失", savedAt: 1 } }),
    );

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("# 未丢失");
    expect(screen.queryByText("secret-path/api-key")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: /复制|Copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("# 未丢失"));
  });

  it("复制崩溃草稿前把本地图片引用换成可携带的 data URI", async () => {
    const ref = await saveImageDataUrl(redPixel);
    __resetImageCacheForTests();
    window.localStorage.setItem(
      StorageKey.draft,
      JSON.stringify({
        v: 1,
        data: { filename: "带图草稿.md", content: `![图](${ref})`, savedAt: 1 },
      }),
    );

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(`![图](${redPixel})`),
    );
    fireEvent.click(screen.getByRole("button", { name: /复制|Copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`![图](${redPixel})`));
  });
});
