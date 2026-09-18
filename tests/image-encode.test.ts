import { describe, expect, it } from "vitest";

import { encodeImageFile, isAcceptedImage, pickImageFiles } from "@/lib/image/encode";

function fileList(...files: File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    ...Object.fromEntries(files.map((file, index) => [index, file])),
  } as unknown as FileList;
}

describe("本地图片编码入口", () => {
  it("拒绝非图片类型", async () => {
    const file = new File(["text"], "note.txt", { type: "text/plain" });
    expect(isAcceptedImage(file)).toBe(false);
    await expect(encodeImageFile(file)).resolves.toEqual({
      ok: false,
      reason: "unsupportedType",
    });
  });

  it("GIF 原样保留以免丢失动画", async () => {
    const file = new File(["gif"], "animated.gif", { type: "image/gif" });
    await expect(encodeImageFile(file)).resolves.toEqual({
      ok: true,
      blob: file,
      width: 0,
      height: 0,
    });
  });

  it("从文件列表中只挑选支持的图片", () => {
    const image = new File(["png"], "image.png", { type: "image/png" });
    const text = new File(["text"], "note.txt", { type: "text/plain" });
    expect(pickImageFiles(fileList(image, text))).toEqual([image]);
  });
});
