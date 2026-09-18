import { IDBDatabase as FakeIDBDatabase, IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRANSPARENT_PIXEL } from "@/lib/image/data-url";
import { __resetImageDbForTests, listImageStamps } from "@/lib/image/db";
import {
  __resetImageCacheForTests,
  __setImageCacheLimitForTests,
  forgetAllImages,
  forgetImages,
  importDataUrls,
  inlineImageRefs,
  inlineImageRefsStrict,
  loadImages,
  peekImageDataUrl,
  peekImageInfo,
  pinImages,
  resolveImageRefs,
  saveImageDataUrl,
  sweepUnusedImages,
} from "@/lib/image/library";
import { buildImageRef, findImageRefIds, imageRefId } from "@/lib/image/ref";

/** 另一张能和透明像素区分开的 1×1 PNG（红点）。 */
const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function setIndexedDb(factory: IDBFactory | undefined) {
  Object.defineProperty(globalThis, "indexedDB", {
    value: factory,
    configurable: true,
    writable: true,
  });
}

describe("图片库", () => {
  beforeEach(() => {
    setIndexedDb(new IDBFactory());
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  afterEach(() => {
    setIndexedDb(undefined);
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  it("存进去的图片能拿到引用，并且立刻可以同步解析", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL, 1, 1);
    expect(ref).not.toBeNull();

    const id = imageRefId(ref ?? "");
    expect(id).not.toBeNull();
    expect(peekImageDataUrl(id ?? "")).toBe(RED_PIXEL);
    expect(peekImageInfo(id ?? "")).toMatchObject({ type: "image/png", width: 1, height: 1 });
    expect(resolveImageRefs(`![图](${ref})`)).toBe(`![图](${RED_PIXEL})`);
  });

  it("还没读上来的先渲染成透明占位，确认没有的才留着引用", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    const missing = buildImageRef("00000000deadbeef");
    // 模拟新会话：库里还在，内存缓存空的。
    __resetImageCacheForTests();

    const source = `![有](${ref})\n\n![没有](${missing})`;
    // 还没查过库，两张都只能先占位。
    expect(resolveImageRefs(source)).toBe(
      `![有](${TRANSPARENT_PIXEL})\n\n![没有](${TRANSPARENT_PIXEL})`,
    );

    await loadImages(findImageRefIds(source));

    // 查过确实没有的那张不再占位，留着引用交给「图片加载失败」那套提示。
    expect(resolveImageRefs(source)).toBe(`![有](${RED_PIXEL})\n\n![没有](${missing})`);
  });

  it("导出时把引用换回 data URI，跨会话也能换", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    __resetImageCacheForTests();

    expect(await inlineImageRefs(`前言\n\n![图](${ref})\n\n后记`)).toBe(
      `前言\n\n![图](${RED_PIXEL})\n\n后记`,
    );
  });

  it("严格导出会列出未解析引用，兼容 API 仍保留原文", async () => {
    const missing = buildImageRef("00000000deadbeef");
    const source = `![没有](${missing})`;

    expect(await inlineImageRefsStrict(source)).toEqual({
      content: source,
      unresolvedIds: ["00000000deadbeef"],
    });
    expect(await inlineImageRefs(source)).toBe(source);
  });

  it("单值图片字段继续支持内联，并能报告缺失", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    expect(await inlineImageRefsStrict(ref ?? "")).toEqual({
      content: RED_PIXEL,
      unresolvedIds: [],
    });

    const missing = buildImageRef("00000000deadbeef");
    expect(await inlineImageRefsStrict(missing)).toEqual({
      content: missing,
      unresolvedIds: ["00000000deadbeef"],
    });
  });

  it("正文里没有引用时原样返回，不惊动 IndexedDB", async () => {
    const source = "只有文字";
    expect(await inlineImageRefs(source)).toBe(source);
  });

  it("导入把内嵌 base64 换成引用，同一张图只存一份", async () => {
    const source = `![一](${RED_PIXEL})\n\n![又一](${RED_PIXEL})\n\n![二](${TRANSPARENT_PIXEL})`;
    const result = await importDataUrls(source);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.content).not.toContain("base64");
    expect(findImageRefIds(result.content)).toHaveLength(2);
    // 换成引用之后还能原样换回来。
    expect(await inlineImageRefs(result.content)).toBe(source);
  });

  it("导入不碰外链图片", async () => {
    const source = "![远](https://example.com/a.png)";
    const result = await importDataUrls(source);

    expect(result).toMatchObject({ content: source, imported: 0, skipped: 0 });
  });

  it("导入只替换 Markdown 图片目标，不碰代码和普通文字", async () => {
    const source = [
      `普通文字 ${RED_PIXEL}`,
      `行内代码 \`![图](${RED_PIXEL})\``,
      "```markdown",
      `![代码块](${RED_PIXEL})`,
      "```",
      `[普通链接](${RED_PIXEL})`,
      `![正文](${RED_PIXEL})`,
    ].join("\n");
    const result = await importDataUrls(source);

    expect(result.imported).toBe(1);
    expect(result.content).toContain(`普通文字 ${RED_PIXEL}`);
    expect(result.content).toContain(`\`![图](${RED_PIXEL})\``);
    expect(result.content).toContain(`![代码块](${RED_PIXEL})`);
    expect(result.content).toContain(`[普通链接](${RED_PIXEL})`);
    expect(result.content).toContain(`![正文](fastype-img:`);
  });

  it("清理删掉没人引用的图，还在用的和刚存的都留着", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now - 10 * 60_000);
    const used = await saveImageDataUrl(RED_PIXEL);
    const dropped = await saveImageDataUrl(TRANSPARENT_PIXEL);
    clock.mockReturnValue(now);
    // 宽限期内刚存下的：可能是另一个标签页刚插进去、还没写进草稿的图。
    const fresh = await saveImageDataUrl(RED_PIXEL);
    clock.mockRestore();

    expect(await sweepUnusedImages([`![还在用](${used})`])).toBe(1);

    const left = (await listImageStamps()).map((stamp) => stamp.id);
    expect(left).toContain(imageRefId(used ?? ""));
    expect(left).toContain(imageRefId(fresh ?? ""));
    expect(left).not.toContain(imageRefId(dropped ?? ""));
  });

  /** 头像、封面和正文插图在同一个库里，只按正文扫一遍就会把它们当成没人要的删掉。 */
  it("清理认所有来源的引用，不只是正文", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now - 10 * 60_000);
    const inBody = await saveImageDataUrl(RED_PIXEL);
    const avatar = await saveImageDataUrl(TRANSPARENT_PIXEL);
    const orphan = await saveImageDataUrl(`${RED_PIXEL.slice(0, -4)}AA==`);
    clock.mockRestore();

    // 第二个来源就是本地设置记录的原文，引用的格式在哪种记录里都一样。
    const settings = JSON.stringify({ v: 1, data: { avatar, name: "我" } });
    expect(await sweepUnusedImages([`![正文](${inBody})`, settings])).toBe(1);

    const left = (await listImageStamps()).map((stamp) => stamp.id);
    expect(left).toContain(imageRefId(inBody ?? ""));
    expect(left).toContain(imageRefId(avatar ?? ""));
    expect(left).not.toContain(imageRefId(orphan ?? ""));
  });

  it("按 id 删除只动指定的那几张", async () => {
    const kept = await saveImageDataUrl(RED_PIXEL);
    const dropped = await saveImageDataUrl(TRANSPARENT_PIXEL);

    await forgetImages([imageRefId(dropped ?? "") ?? ""]);

    const left = (await listImageStamps()).map((stamp) => stamp.id);
    expect(left).toEqual([imageRefId(kept ?? "")]);
  });

  it("同一张图存两次只入库一份，引用也是同一条", async () => {
    const first = await saveImageDataUrl(RED_PIXEL);
    const second = await saveImageDataUrl(RED_PIXEL);

    expect(second).toBe(first);
    expect(await listImageStamps()).toHaveLength(1);
  });

  it("LRU 只淘汰未使用图片，被当前渲染链固定的图片等释放后再清", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    const id = imageRefId(ref ?? "") ?? "";
    const release = pinImages([id]);

    __setImageCacheLimitForTests(0);
    expect(peekImageDataUrl(id)).toBe(RED_PIXEL);

    release();
    expect(peekImageDataUrl(id)).toBeNull();
    expect(await inlineImageRefs(`![图](${ref})`)).toBe(`![图](${RED_PIXEL})`);
  });

  it("清空图片库之后原来的引用解析不出东西", async () => {
    const ref = await saveImageDataUrl(RED_PIXEL);
    await forgetAllImages();

    expect(await listImageStamps()).toHaveLength(0);
    expect(await inlineImageRefs(`![图](${ref})`)).toBe(`![图](${ref})`);
  });

  it("删除事务失败时不清缓存，并准确返回失败", async () => {
    const old = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 10 * 60_000);
    const ref = await saveImageDataUrl(RED_PIXEL);
    old.mockRestore();
    const id = imageRefId(ref ?? "") ?? "";
    const original = FakeIDBDatabase.prototype.transaction;
    const transaction = vi
      .spyOn(FakeIDBDatabase.prototype, "transaction")
      .mockImplementation(function (
        this: IDBDatabase,
        storeNames: string | Iterable<string>,
        mode?: IDBTransactionMode,
        options?: IDBTransactionOptions,
      ) {
        if (mode === "readwrite") throw new DOMException("write failed", "UnknownError");
        return original.call(this, storeNames, mode, options);
      });

    expect(await sweepUnusedImages([])).toBe(0);
    expect(await forgetImages([id])).toBe(false);
    expect(await forgetAllImages()).toBe(false);
    expect(peekImageDataUrl(id)).toBe(RED_PIXEL);
    expect(resolveImageRefs(`![还在](${ref})`)).toBe(`![还在](${RED_PIXEL})`);

    transaction.mockRestore();
    expect((await listImageStamps()).map((stamp) => stamp.id)).toEqual([id]);
  });

  it("IndexedDB 用不了时安全降级：存不进去，正文原样不动", async () => {
    setIndexedDb(undefined);
    __resetImageDbForTests();

    expect(await saveImageDataUrl(RED_PIXEL)).toBeNull();
    const source = `![图](${RED_PIXEL})`;
    expect(await importDataUrls(source)).toMatchObject({
      content: source,
      imported: 0,
      skipped: 1,
    });
    expect(await sweepUnusedImages([source])).toBe(0);
  });
});
