import { describe, expect, it } from "vitest";

import {
  buildImageRef,
  findImageRefIds,
  findMarkdownImageTargets,
  imageRefId,
  newImageId,
  replaceMarkdownImageTargets,
  replaceImageRefs,
} from "@/lib/image/ref";

const A = "0123456789abcdef";
const B = "fedcba9876543210";

describe("图片引用", () => {
  it("生成的 id 是 16 位十六进制且不重复", () => {
    const ids = Array.from({ length: 50 }, newImageId);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("整条 src 是引用时取得 id，其它来源不认", () => {
    expect(imageRefId(buildImageRef(A))).toBe(A);
    expect(imageRefId(` ${buildImageRef(A)} `)).toBe(A);
    expect(imageRefId("https://example.com/a.png")).toBeNull();
    expect(imageRefId("data:image/png;base64,AAAA")).toBeNull();
    // 尾巴上多出来的字符说明这不是一条干净的引用。
    expect(imageRefId(`${buildImageRef(A)}x`)).toBeNull();
    expect(imageRefId("fastype-img:短了点")).toBeNull();
  });

  it("列出正文里的 id，去重且保持出现顺序", () => {
    const source = `![一](${buildImageRef(B)})\n\n![二](${buildImageRef(A)})\n\n![还是一](${buildImageRef(B)})`;
    expect(findImageRefIds(source)).toEqual([B, A]);
  });

  it("换不出来的引用原样留着，不会被清成空字符串", () => {
    const source = `![一](${buildImageRef(A)}) ![二](${buildImageRef(B)})`;
    const replaced = replaceImageRefs(source, (id) =>
      id === A ? "data:image/png;base64,AA" : null,
    );

    expect(replaced).toBe(`![一](data:image/png;base64,AA) ![二](${buildImageRef(B)})`);
  });

  it("不碰正文里长得像引用但不是引用的文字", () => {
    const source = `普通文字 ${buildImageRef(A)}，链接 [一](${buildImageRef(A)})`;
    expect(replaceImageRefs(source, () => "换掉了")).toBe(source);
    expect(findImageRefIds(source)).toEqual([]);
  });

  it("代码块、缩进代码和行内代码里的图片语法都不参与查找或替换", () => {
    const source = [
      `行内 \`![一](${buildImageRef(A)})\``,
      "```markdown",
      `![二](${buildImageRef(A)})`,
      "```",
      `    ![三](${buildImageRef(A)})`,
      `![正文](${buildImageRef(B)})`,
    ].join("\n");

    expect(findImageRefIds(source)).toEqual([B]);
    expect(replaceImageRefs(source, () => "data:image/png;base64,AA==")).toBe(
      source.replace(buildImageRef(B), "data:image/png;base64,AA=="),
    );
  });

  it("轻量扫描器只返回 Markdown 图片目标并保留目标位置", () => {
    const source = `前 ![嵌套 [说明]](<${buildImageRef(A)}> "标题") 后`;
    const targets = findMarkdownImageTargets(source);

    expect(targets.map((target) => target.value)).toEqual([buildImageRef(A)]);
    expect(source.slice(targets[0].start, targets[0].end)).toBe(buildImageRef(A));
    expect(replaceMarkdownImageTargets(source, () => "next.png")).toBe(
      '前 ![嵌套 [说明]](<next.png> "标题") 后',
    );
  });
});
