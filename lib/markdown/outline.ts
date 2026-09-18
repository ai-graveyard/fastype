export interface MarkdownHeading {
  level: 1 | 2 | 3;
  text: string;
  line: number;
}

/** 提取编辑器目录使用的 H1–H3；围栏代码块里的伪标题必须跳过。 */
export function extractMarkdownOutline(source: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let fenceMarker = "";
  let fenceLength = 0;

  source.split(/\r?\n/).forEach((line, index) => {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!fenceMarker) {
        fenceMarker = marker;
        fenceLength = fence[1].length;
      } else if (marker === fenceMarker && fence[1].length >= fenceLength) {
        fenceMarker = "";
        fenceLength = 0;
      }
      return;
    }
    if (fenceMarker) return;

    const heading = line.match(/^\s{0,3}(#{1,3})[ \t]+(.+?)\s*$/);
    if (!heading) return;
    const text = heading[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (!text) return;
    headings.push({
      level: heading[1].length as 1 | 2 | 3,
      text,
      line: index + 1,
    });
  });

  return headings;
}
