import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildPagesZip } from "@/lib/export/png";

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
    expect(Object.keys(zip.files)).toEqual([
      "我的文章-xhs-01.png",
      "我的文章-xhs-03.png",
    ]);
    expect(await zip.file("我的文章-xhs-01.png")?.async("text")).toBe("page one");
  });

  it("没有成功页面时不生成空 ZIP", async () => {
    await expect(buildPagesZip([{ index: 0, ok: false }], "空文章")).resolves.toBeNull();
  });
});
