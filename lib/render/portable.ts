/**
 * 把编辑器预览那棵 DOM 变成自包含的 HTML：样式全部写进 inline style，
 * 复制到剪贴板、下载成单文件 HTML、送进打印都用同一份产物。
 *
 * 和公众号渲染器（lib/render/wechat.ts）走的是两条路：那边是按平台配置重新
 * 算一套内联样式，这边直接读预览的 computed style，所以八套预览主题都不用
 * 单独适配，屏幕上什么样，粘出去就是什么样。
 */

/** 写进 inline style 的属性。只保留影响阅读排版的那些，免得产物臃肿。 */
const COPIED_PROPERTIES = [
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration-line",
  "text-indent",
  "text-transform",
  "white-space",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "border-collapse",
  "list-style-type",
  "list-style-position",
  "opacity",
] as const;

/**
 * 会从父元素继承下来的属性：父子同值时省略不写。
 *
 * 产物是一棵完整的树，继承链还在，所以省掉的值粘贴后依然生效；
 * 一篇长文这样能省掉一多半体积。
 */
const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-indent",
  "text-transform",
  "white-space",
  "list-style-type",
  "list-style-position",
]);

/** 预览里的内部标记，粘出去没有意义。 */
const DROPPED_ATTRIBUTES = [
  "class",
  "id",
  "data-source-line",
  "loading",
  "referrerpolicy",
  "srcset",
  "sizes",
  "crossorigin",
];

/**
 * 预览为了适应分栏做的取舍，粘出去要还原成正常文档的样子。
 *
 * 预览里表格是 `display: block` 加横向滚动（窄栏放不下时不撑破布局），
 * 代码块是 `overflow-x: auto`；到了文档里没有滚动条这回事，
 * 表格该铺满宽度，代码该折行，否则粘过去就是被截断的一行。
 */
const ELEMENT_OVERRIDES: Record<string, Record<string, string>> = {
  pre: { "white-space": "pre-wrap", "word-break": "break-word", "overflow-x": "visible" },
  table: { display: "table", width: "100%", "max-width": "100%" },
  img: { "max-width": "100%", height: "auto" },
};

/** 现代色彩语法在公众号编辑器和 Word 里认不出来，退回 rgb/hex。 */
const MODERN_COLOR = /\b(oklch|oklab|lch|lab|color)\(/;

let colorCanvas: CanvasRenderingContext2D | null | undefined;

function colorContext(): CanvasRenderingContext2D | null {
  if (colorCanvas !== undefined) return colorCanvas;
  try {
    colorCanvas = document.createElement("canvas").getContext("2d");
  } catch {
    colorCanvas = null;
  }
  return colorCanvas;
}

function toLegacyColor(value: string): string {
  if (!MODERN_COLOR.test(value)) return value;
  const context = colorContext();
  if (!context) return value;
  try {
    context.fillStyle = "#000000";
    context.fillStyle = value;
    return typeof context.fillStyle === "string" ? context.fillStyle : value;
  } catch {
    return value;
  }
}

/**
 * 取默认值的属性一律不写。
 *
 * 这些声明每个元素都会带一条（`border-collapse: separate` 尤其明显），
 * 写出来既不改变任何效果，又能让产物凭空胖上一两成。
 */
function isNoopValue(property: string, value: string): boolean {
  if (!value) return true;
  if (property === "background-color") {
    return value === "transparent" || value === "rgba(0, 0, 0, 0)";
  }
  if (property.startsWith("border-") && property !== "border-radius") {
    return value.startsWith("0px") || value.includes("none") || value === "separate";
  }
  if (property === "text-decoration-line") return value === "none";
  if (property === "opacity") return value === "1";
  if (property === "text-indent" || property === "border-radius") return value === "0px";
  return false;
}

function inlineStyleFor(
  element: Element,
  computed: CSSStyleDeclaration,
  parentComputed: CSSStyleDeclaration | null,
): string {
  // 用 Map 收集，元素级覆盖直接顶掉同名的 computed 值，不会出现同一属性写两遍。
  const declarations = new Map<string, string>();

  for (const property of COPIED_PROPERTIES) {
    const raw = computed.getPropertyValue(property).trim();
    if (isNoopValue(property, raw)) continue;
    if (
      INHERITED_PROPERTIES.has(property) &&
      parentComputed &&
      parentComputed.getPropertyValue(property).trim() === raw
    ) {
      continue;
    }
    declarations.set(property, toLegacyColor(raw));
  }

  const overrides = ELEMENT_OVERRIDES[element.tagName.toLowerCase()];
  if (overrides) {
    for (const [property, value] of Object.entries(overrides)) {
      declarations.set(property, value);
    }
  }

  return Array.from(declarations, ([property, value]) => `${property}: ${value}`).join("; ");
}

/**
 * 克隆预览节点并把 computed style 内联进去。
 *
 * 原节点和克隆体的元素顺序一定一致（深拷贝不会重排），所以两边各拉一份
 * `querySelectorAll("*")` 就能按下标配对，不必递归遍历。
 */
export function buildPortableNode(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals: Element[] = [source, ...Array.from(source.querySelectorAll("*"))];
  const clones: Element[] = [clone, ...Array.from(clone.querySelectorAll("*"))];

  for (let index = 0; index < originals.length; index += 1) {
    const original = originals[index];
    const target = clones[index];
    if (!target) break;

    const computed = window.getComputedStyle(original);
    // 根节点没有可继承的上文，整套值都要写全，否则粘贴环境的默认样式会顶上来。
    const parent = index === 0 ? null : original.parentElement;
    const parentComputed = parent ? window.getComputedStyle(parent) : null;

    for (const attribute of DROPPED_ATTRIBUTES) target.removeAttribute(attribute);
    const style = inlineStyleFor(original, computed, parentComputed);
    if (style) target.setAttribute("style", style);
    else target.removeAttribute("style");
  }

  // 预览容器是靠 flex 居中的，脱离工作台后要自己撑住宽度。
  const rootStyle = clone.getAttribute("style") ?? "";
  clone.setAttribute("style", `${rootStyle}; box-sizing: border-box; margin: 0 auto`);
  return clone;
}

export interface PortableResult {
  /** 内联好样式的 HTML，可直接进剪贴板或写成文件。 */
  html: string;
  /** 同一份内容的纯文本，作为剪贴板的降级格式。 */
  plainText: string;
}

export function buildPortableHtml(source: HTMLElement): PortableResult {
  const node = buildPortableNode(source);
  return {
    html: node.outerHTML,
    // innerText 会保留块级元素之间的换行；jsdom 里没有实现，退回 textContent。
    plainText: (source.innerText ?? source.textContent ?? "").trim(),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[<>&"]/g, (char) =>
    char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === "&" ? "&amp;" : "&quot;",
  );
}

/** 单文件 HTML：不引用任何外部资源，双击就能在浏览器里打开。 */
export function buildStandaloneDocument(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0">${bodyHtml}</body>
</html>`;
}
