import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createWechatPackage } from "@/lib/export/wechat-package";

describe("公众号发布包", () => {
  it("同时包含文章 HTML、横版封面和方形封面", async () => {
    const blob = await createWechatPackage({
      baseName: "我的文章",
      wideCover: new Blob(["wide"], { type: "image/png" }),
      squareCover: new Blob(["square"], { type: "image/png" }),
      articleHtml: "<!doctype html><title>我的文章</title>",
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(
      [
        "我的文章-wechat-cover-500x500.png",
        "我的文章-wechat-cover-900x383.png",
        "我的文章-wechat.html",
      ].sort(),
    );
    expect(await zip.file("我的文章-wechat-cover-900x383.png")?.async("text")).toBe("wide");
    expect(await zip.file("我的文章-wechat-cover-500x500.png")?.async("text")).toBe("square");
    expect(await zip.file("我的文章-wechat.html")?.async("text")).toContain(
      "<title>我的文章</title>",
    );
  });
});
