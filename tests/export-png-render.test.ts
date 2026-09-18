import { beforeEach, describe, expect, it, vi } from "vitest";

const toBlob = vi.fn();

vi.mock("html-to-image", () => ({ toBlob }));

import { renderPageToBlob } from "@/lib/export/png";

describe("PNG 单页渲染", () => {
  beforeEach(() => {
    toBlob.mockReset();
  });

  it("把缩放、背景和字体配置交给同一导出节点", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    toBlob.mockResolvedValue(blob);
    const node = document.createElement("article");

    await expect(
      renderPageToBlob(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        fontEmbedCSS: "@font-face {}",
      }),
    ).resolves.toBe(blob);

    expect(toBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: false,
        fontEmbedCSS: "@font-face {}",
      }),
    );
  });

  it("没有自托管字体时跳过字体扫描", async () => {
    toBlob.mockResolvedValue(null);
    await expect(
      renderPageToBlob(document.createElement("article"), {
        scale: 1,
        backgroundColor: "transparent",
      }),
    ).resolves.toBeNull();
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ skipFonts: true, fontEmbedCSS: undefined }),
    );
  });
});
