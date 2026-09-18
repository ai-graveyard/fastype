import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DocumentProvider,
  useDocument,
  __resetDraftForTests,
} from "@/components/providers/document-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { __resetImageDbForTests, getImage, listImageStamps } from "@/lib/image/db";
import { __resetImageCacheForTests, inlineImageRefs, saveImageDataUrl } from "@/lib/image/library";
import { StorageKey, __resetStorageStateForTests } from "@/lib/storage";

const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function ContentProbe() {
  const { clearDraft, content, downloadMarkdown, setContent } = useDocument();
  const [downloaded, setDownloaded] = React.useState("");
  return (
    <>
      <span data-testid="content">{content}</span>
      <span data-testid="downloaded">{downloaded}</span>
      <button type="button" onClick={() => setContent(`![运行时图片](${RED_PIXEL})`)}>
        paste-image
      </button>
      <button type="button" onClick={clearDraft}>
        clear-draft
      </button>
      <button
        type="button"
        onClick={() => void downloadMarkdown().then((ok) => setDownloaded(String(ok)))}
      >
        download
      </button>
    </>
  );
}

function storeDraft(content: string) {
  window.localStorage.setItem(
    StorageKey.draft,
    JSON.stringify({ v: 1, data: { filename: "带图.md", content, savedAt: 1 } }),
  );
}

function draftContent(): string {
  const raw = JSON.parse(window.localStorage.getItem(StorageKey.draft) ?? "null") as {
    data?: { content?: string };
  } | null;
  return raw?.data?.content ?? "";
}

const tree = (
  <PrefsProvider>
    <DocumentProvider>
      <ContentProbe />
    </DocumentProvider>
  </PrefsProvider>
);

function renderDocument() {
  render(tree);
}

describe("正文图片搬进 IndexedDB", () => {
  /** 水合那个用例自己挂容器，交给 afterEach 收——用例中途断言失败也不会漏到下一个。 */
  let hydrated: { root: Root; container: HTMLElement } | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    // 草稿缓存和图片库连接都是模块级的，不重置的话上一个用例的正文会串到下一个。
    __resetDraftForTests();
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  afterEach(async () => {
    if (hydrated) {
      const { root, container } = hydrated;
      hydrated = null;
      await act(async () => root.unmount());
      container.remove();
    }
    cleanup();
    __resetStorageStateForTests();
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  /** 升级前存下的草稿里是一整串 base64，正是它把 localStorage 顶爆的。 */
  it("启动时把草稿里内嵌的 base64 换成引用，并且换得回来", async () => {
    const original = `# 标题\n\n![图](${RED_PIXEL})`;
    storeDraft(original);
    renderDocument();

    await waitFor(() =>
      expect(screen.getByTestId("content").textContent).toMatch(/fastype-img:[0-9a-f]{16}/),
    );

    const migrated = screen.getByTestId("content").textContent ?? "";
    expect(migrated).not.toContain("base64");
    // 草稿本身也得换掉，不然下次启动还是那份大的。
    await waitFor(() => expect(draftContent()).toBe(migrated));
    expect(await listImageStamps()).toHaveLength(1);
    // 导出那一刻还原成自包含的一份。
    expect(await inlineImageRefs(migrated)).toBe(original);
  });

  it("正文里没有内嵌图片时不动草稿", async () => {
    storeDraft("# 只有文字");
    renderDocument();

    await act(async () => {});

    expect(screen.getByTestId("content").textContent).toBe("# 只有文字");
    expect(draftContent()).toBe("# 只有文字");
  });

  /**
   * 真实页面是先水合再接管的，而水合那一帧 useSyncExternalStore 交出来的是服务端快照
   * ——一份空草稿。迁移要是在那一帧就动手，本地那份带图的草稿一个字都搬不走，而且守卫
   * 变量已经置位，之后再也不会补做。直接 render 的用例看不出这个差别，得真水合一次。
   */
  it("等水合完成再迁移，不会对着服务端那份空草稿空跑一趟", async () => {
    const original = `# 水合\n\n![图](${RED_PIXEL})`;
    storeDraft(original);

    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    // 服务端那一份必须是空的，否则这个用例根本没在测水合。
    expect(container.textContent).not.toContain("水合");

    await act(async () => {
      hydrated = { root: hydrateRoot(container, tree), container };
    });

    await waitFor(() => expect(container.textContent).toMatch(/fastype-img:[0-9a-f]{16}/));
    await waitFor(() => expect(draftContent()).not.toContain("base64"));
    expect(await inlineImageRefs(draftContent())).toBe(original);
  });

  it("IndexedDB 用不了时草稿保持原样，内嵌图片照常可用", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();

    const original = `![图](${RED_PIXEL})`;
    storeDraft(original);
    renderDocument();

    await act(async () => {});

    expect(screen.getByTestId("content").textContent).toBe(original);
    expect(draftContent()).toBe(original);
  });

  it("启动后粘贴的内嵌图片也会搬进 IndexedDB", async () => {
    storeDraft("# 初始正文");
    renderDocument();

    fireEvent.click(screen.getByRole("button", { name: "paste-image" }));

    await waitFor(() =>
      expect(screen.getByTestId("content").textContent).toMatch(/fastype-img:[0-9a-f]{16}/),
    );
    expect(screen.getByTestId("content").textContent).not.toContain("base64");
    expect(await listImageStamps()).toHaveLength(1);
  });

  it("清草稿不会删除仍被头像或封面引用的同一张图片", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    expect(ref).not.toBeNull();
    storeDraft(`![正文图](${ref})`);
    window.localStorage.setItem(
      StorageKey.userProfile,
      JSON.stringify({ v: 1, data: { avatar: ref, name: "我", slogan: "签名" } }),
    );
    renderDocument();

    fireEvent.click(screen.getByRole("button", { name: "clear-draft" }));
    await act(async () => {});

    const id = ref!.slice("fastype-img:".length);
    expect(await getImage(id)).not.toBeNull();
  });

  it("本地图片丢失时阻止生成不完整的 Markdown", async () => {
    storeDraft("![丢失](fastype-img:00000000deadbeef)");
    renderDocument();

    fireEvent.click(screen.getByRole("button", { name: "download" }));

    await waitFor(() => expect(screen.getByTestId("downloaded").textContent).toBe("false"));
  });
});
