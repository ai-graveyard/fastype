import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPagesZip, collectCrossOriginImages, findUnexportableImages } from "@/lib/export/png";

describe("小红书 ZIP 导出", () => {
  it("只打包成功生成的 PNG，并保留原页码", async () => {
    const archive = await buildPagesZip(
      [
        { index: 0, ok: true, blob: new Blob(["page one"], { type: "image/png" }) },
        { index: 1, ok: false },
        { index: 2, ok: true, blob: new Blob(["page three"], { type: "image/png" }) },
      ],
      "我的文章",
    );

    expect(archive?.included).toBe(2);
    const zip = await JSZip.loadAsync(await archive!.blob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(["我的文章-xhs-01.png", "我的文章-xhs-03.png"]);
    expect(await zip.file("我的文章-xhs-01.png")?.async("text")).toBe("page one");
  });

  it("没有成功页面时不生成空 ZIP", async () => {
    await expect(buildPagesZip([{ index: 0, ok: false }], "空文章")).resolves.toBeNull();
  });
});

function mountImages(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

/** jsdom 不真的加载图片，naturalWidth 恒为 0，所以按用例需要显式伪造。 */
function fakeLoaded(root: HTMLElement) {
  root.querySelectorAll("img").forEach((img) => {
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 100, configurable: true });
  });
}

describe("导出前的图片可用性探测", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("只探测跨域图片，同源和 data URL 不发请求", () => {
    const root = mountImages(
      `<img src="/local.png">
       <img src="${window.location.origin}/same-origin.png">
       <img src="data:image/png;base64,AAAA">
       <img src="https://cdn.example.com/remote.png">
       <img src="https://cdn.example.com/remote.png">`,
    );
    expect(collectCrossOriginImages([root])).toEqual(["https://cdn.example.com/remote.png"]);
  });

  it("图源不放行跨域时列为「导出会缺」，即使预览里显示正常", async () => {
    const root = mountImages('<img src="https://cdn.example.com/no-cors.png">');
    fakeLoaded(root);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(findUnexportableImages([root])).resolves.toEqual([
      "https://cdn.example.com/no-cors.png",
    ]);
  });

  it("图源放行跨域时不报警", async () => {
    const root = mountImages('<img src="https://cdn.example.com/ok.png">');
    fakeLoaded(root);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as Response));

    await expect(findUnexportableImages([root])).resolves.toEqual([]);
  });

  it("预览里就没加载出来的图片直接计入，不再重复探测", async () => {
    const root = mountImages('<img src="https://cdn.example.com/broken.png">');
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(findUnexportableImages([root])).resolves.toEqual([
      "https://cdn.example.com/broken.png",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("多页共用同一张图时只探测一次", async () => {
    const first = mountImages('<img src="https://cdn.example.com/shared.png">');
    const second = mountImages('<img src="https://cdn.example.com/shared.png">');
    fakeLoaded(first);
    fakeLoaded(second);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(findUnexportableImages([first, second])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
