import { SOURCE_LINE_ATTRIBUTE } from "@/lib/markdown/parse";

export interface LayoutBlock {
  key: string;
  line: number;
  label: string;
  heading: boolean;
}
function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/** Content anchors survive lines inserted above them. Ambiguous duplicate blocks are intentionally unavailable. */
export function layoutBlocks(html: string, source: string): LayoutBlock[] {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const lines = source.split(/\r?\n/);
  const nodes = Array.from(holder.children);
  const blocks = nodes.flatMap((node, index) => {
    const line = Number(node.getAttribute(SOURCE_LINE_ATTRIBUTE));
    if (!line || line < 1 || line > lines.length) return [];
    const nextLine =
      Number(nodes[index + 1]?.getAttribute(SOURCE_LINE_ATTRIBUTE)) || lines.length + 1;
    const raw = lines
      .slice(line - 1, nextLine - 1)
      .join("\n")
      .trim();
    return [
      {
        key: fingerprint(raw),
        line,
        label: (
          node.textContent?.trim() ||
          node.querySelector("img")?.getAttribute("alt") ||
          raw
        ).slice(0, 90),
        heading: /^H[1-6]$/.test(node.tagName),
      },
    ];
  });
  return blocks.filter((block) => blocks.filter((other) => other.key === block.key).length === 1);
}

export function applyLayoutBreaks(html: string, blocks: LayoutBlock[], keys: string[]): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const lines = new Set(
    blocks.filter((block) => keys.includes(block.key)).map((block) => block.line),
  );
  for (const node of Array.from(holder.children)) {
    if (lines.has(Number(node.getAttribute(SOURCE_LINE_ATTRIBUTE))))
      node.setAttribute("data-page-break-before", "true");
  }
  return holder.innerHTML;
}
