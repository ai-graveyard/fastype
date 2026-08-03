/**
 * 图表代码块（```mermaid / ```markmap）。
 *
 * 解析阶段只把它们换成一个带源码的空占位；真正的渲染是异步的（mermaid 和 markmap
 * 都要动态 import，几百 KB 不该进主包），由 hooks/use-diagrams.ts 在挂载后填进去。
 *
 * 三个视图共用同一份占位，所以「预览、导出、复制看到的是同一棵 DOM」这条继续成立。
 */

export const DIAGRAM_KINDS = ["mermaid", "markmap"] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

export const DIAGRAM_CLASS = "ft-diagram";
export const DIAGRAM_KIND_ATTRIBUTE = "data-diagram";
export const DIAGRAM_SOURCE_ATTRIBUTE = "data-diagram-source";
/** 渲染完成后打在占位上，避免同一份源码被重复渲染。 */
export const DIAGRAM_STATE_ATTRIBUTE = "data-diagram-state";
/** 图的自然宽度，渲染时写在占位上，由各视图的样式表决定要不要用。 */
export const DIAGRAM_WIDTH_VARIABLE = "--ft-diagram-width";

export function isDiagramKind(value: string): value is DiagramKind {
  return (DIAGRAM_KINDS as readonly string[]).includes(value);
}

/**
 * 源码要塞进 HTML 属性里，先转成 base64。
 *
 * 直接写属性也能工作（转义引号即可），但图表源码里的换行、引号和中括号很多，
 * base64 省掉一层容易出错的转义，也让 DOMPurify 那边不必判断属性内容。
 */
export function encodeDiagramSource(source: string): string {
  if (typeof window === "undefined") return "";
  // btoa 只接受 Latin-1，中文标签必须先过一遍 UTF-8。
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

export function decodeDiagramSource(encoded: string): string {
  if (typeof window === "undefined") return "";
  try {
    const binary = window.atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** 占位 HTML。渲染前是空的，高度为 0，分页测量会在渲染完成后重跑。 */
export function diagramPlaceholderHtml(kind: DiagramKind, source: string): string {
  return `<div class="${DIAGRAM_CLASS}" ${DIAGRAM_KIND_ATTRIBUTE}="${kind}" ${DIAGRAM_SOURCE_ATTRIBUTE}="${encodeDiagramSource(source)}"></div>`;
}
