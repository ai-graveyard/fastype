import { describe, expect, it } from "vitest";

import {
  dataUrlByteLength,
  dataUrlFormat,
  formatBytes,
  isImageDataUrl,
} from "@/lib/image/data-url";
import {
  findImageAt,
  findImageMarkups,
  stringifyImageMarkup,
  type ImageMarkup,
} from "@/lib/markdown/image-markup";
import { renderMarkdown } from "@/lib/markdown/parse";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const DEFAULTS: ImageMarkup = { alt: "图", src: "a.png", width: 100, align: "center" };

describe("data URI 工具", () => {
  it("认得图片 data URI，不认其它类型", () => {
    expect(isImageDataUrl(PIXEL)).toBe(true);
    expect(isImageDataUrl("data:text/plain;base64,aGk=")).toBe(false);
    expect(isImageDataUrl("https://example.test/a.png")).toBe(false);
  });

  it("能从 base64 长度反推字节数", () => {
    // 1×1 透明 PNG 是 68 字节。
    expect(dataUrlByteLength(PIXEL)).toBe(68);
    expect(dataUrlByteLength("not a data url")).toBe(0);
  });

  it("取得出格式名", () => {
    expect(dataUrlFormat(PIXEL)).toBe("PNG");
    expect(dataUrlFormat("data:image/webp;base64,AA==")).toBe("WEBP");
  });

  it("字节数按量级换算", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("图片标记的生成", () => {
  it("默认宽度加默认对齐时退回朴素 Markdown", () => {
    expect(stringifyImageMarkup(DEFAULTS)).toBe("![图](a.png)");
  });

  it("调过宽度就落成 HTML", () => {
    expect(stringifyImageMarkup({ ...DEFAULTS, width: 50 })).toBe(
      '<p align="center"><img src="a.png" alt="图" width="50%"></p>',
    );
  });

  it("调过对齐也落成 HTML", () => {
    expect(stringifyImageMarkup({ ...DEFAULTS, align: "left" })).toBe(
      '<p align="left"><img src="a.png" alt="图" width="100%"></p>',
    );
  });

  it("alt 里的引号和中括号不会撑破标记", () => {
    const markup = stringifyImageMarkup({ ...DEFAULTS, alt: 'a"b[c]', width: 75 });
    expect(markup).toContain('alt="a&quot;bc"');
    expect(markup.match(/<img/g)).toHaveLength(1);
  });

  it("宽度被夹在 1 到 100 之间", () => {
    expect(stringifyImageMarkup({ ...DEFAULTS, width: 0, align: "left" })).toContain('width="1%"');
    expect(stringifyImageMarkup({ ...DEFAULTS, width: 999, align: "left" })).toContain(
      'width="100%"',
    );
  });
});

describe("图片标记的解析", () => {
  it("找得到 Markdown 图片", () => {
    const found = findImageMarkups("前言\n\n![说明](a.png)\n\n后记");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ alt: "说明", src: "a.png", width: 100, align: "center" });
  });

  it("找得到带宽度和对齐的 HTML 图片", () => {
    const found = findImageMarkups('<p align="right"><img src="b.png" alt="说明" width="40%"></p>');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ alt: "说明", src: "b.png", width: 40, align: "right" });
  });

  it("裸 img 也认，按默认对齐算", () => {
    const found = findImageMarkups('<img src="c.png" width="30%">');
    expect(found[0]).toMatchObject({ src: "c.png", width: 30, align: "center" });
  });

  it("多张图按出现顺序排列", () => {
    const source =
      '![一](1.png)\n\n<p align="left"><img src="2.png" width="50%"></p>\n\n![三](3.png)';
    expect(findImageMarkups(source).map((image) => image.src)).toEqual(["1.png", "2.png", "3.png"]);
  });

  it("生成再解析回来是同一张图", () => {
    const original: ImageMarkup = { alt: "说明", src: PIXEL, width: 75, align: "right" };
    const parsed = findImageMarkups(stringifyImageMarkup(original))[0];
    expect(parsed).toMatchObject(original);
  });

  it("按位置定位光标所在的那张图", () => {
    const source = "前言 ![一](1.png) 中间 ![二](2.png) 后记";
    const second = source.indexOf("![二]");
    expect(findImageAt(source, second + 2)?.src).toBe("2.png");
    expect(findImageAt(source, 1)).toBeNull();
  });
});

describe("宽度和对齐能活到渲染层", () => {
  it("消毒不会剥掉 width 与 align", () => {
    const { html } = renderMarkdown(
      '<p align="right"><img src="https://a.test/b.png" alt="说明" width="40%"></p>',
    );
    const holder = document.createElement("div");
    holder.innerHTML = html;

    const image = holder.querySelector("img");
    expect(image?.getAttribute("width")).toBe("40%");
    expect(image?.closest("p")?.getAttribute("align")).toBe("right");
  });
});
