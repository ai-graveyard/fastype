import DOMPurify from "dompurify";
import { Marked } from "marked";

import {
  DIAGRAM_KIND_ATTRIBUTE,
  DIAGRAM_SOURCE_ATTRIBUTE,
  DIAGRAM_STATE_ATTRIBUTE,
  diagramPlaceholderHtml,
  isDiagramKind,
} from "@/lib/markdown/diagram";
import { HIGHLIGHT_LANGUAGE_ATTRIBUTE, normalizeCodeLanguage } from "@/lib/markdown/highlight";

/**
 * 三个视图共用同一套解析规则（PRD 产品原则 3「所见接近所得」、12.3）。
 *
 * breaks: true —— 目标用户是中文创作者，源码里的换行就是他们想要的换行；
 * 小红书和公众号预览、导出都基于同一份 HTML，不存在两套解析。
 */
const marked = new Marked({
  gfm: true,
  breaks: true,
  pedantic: false,
});

/**
 * 围栏代码块的两种去向：
 * - ```mermaid / ```markmap 换成图表占位，挂载后异步渲染（lib/markdown/diagram.ts）；
 * - 其余带语言标记的代码块留下语言名，交给高亮那一步（lib/markdown/highlight.ts）。
 *
 * 语言名单独放属性而不是沿用 marked 默认的 `class="language-x"`：公众号转换会剥掉
 * 所有 class（内联样式那条路不认 class），属性能一直留到需要它的地方。
 */
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
      if (isDiagramKind(language)) return diagramPlaceholderHtml(language, text);

      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const normalized = normalizeCodeLanguage(language);
      const attribute = normalized ? ` ${HIGHLIGHT_LANGUAGE_ATTRIBUTE}="${normalized}"` : "";
      return `<pre><code${attribute}>${escaped}\n</code></pre>\n`;
    },
  },
});

const FORBID_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "textarea",
  "select",
  "button",
  "link",
  "meta",
  "base",
  "noscript",
];

export interface RenderResult {
  /** 已消毒的 HTML，可直接注入预览。 */
  html: string;
  /** 第一个一级标题，没有时为 null（FT-XHS-001）。 */
  title: string | null;
  /** 正文纯文本，用于字数统计与平台字数限制提示。 */
  text: string;
  /** 出现过的图片地址，去重后按出现顺序排列。 */
  images: string[];
}

const EMPTY: RenderResult = { html: "", title: null, text: "", images: [] };

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * 消毒任意 HTML 字符串（PRD 10.2）。
 *
 * 过滤脚本、事件属性和危险协议；style 属性单独禁止，因为内联 style 里的 url()
 * 会在渲染时发起悄悄的第三方请求，违背「不引入第三方运行时请求」的前提，
 * 且不是默认属性白名单能拦住的（FORBID_ATTR 需要显式声明）。
 *
 * 渲染层（lib/render/wechat.ts、lib/render/xhs.ts）在把 HTML 字符串塞进
 * `innerHTML` 前会再调用一次本函数兜底，不完全依赖调用方「已经消毒过」的约定。
 */
export function sanitizeHtml(rawHtml: string): DocumentFragment {
  return DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS,
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
    // 图表占位和代码语言这三个 data-* 是我们自己写进去的，得在 ALLOW_DATA_ATTR:false 下逐个放行。
    ADD_ATTR: [
      "target",
      "rel",
      DIAGRAM_KIND_ATTRIBUTE,
      DIAGRAM_SOURCE_ATTRIBUTE,
      DIAGRAM_STATE_ATTRIBUTE,
      HIGHLIGHT_LANGUAGE_ATTRIBUTE,
    ],
    RETURN_DOM_FRAGMENT: true,
  }) as unknown as DocumentFragment;
}

/**
 * Markdown → 安全 HTML。
 *
 * 静态导出在 Node 里预渲染时没有 DOM，此时返回空结果；预览组件都是客户端挂载后才渲染。
 */
export function renderMarkdown(source: string): RenderResult {
  if (!source.trim()) return EMPTY;
  if (!canUseDom()) return EMPTY;

  const rawHtml = marked.parse(source, { async: false }) as string;
  const root = sanitizeHtml(rawHtml);

  const holder = window.document.createElement("div");
  holder.appendChild(root);

  const images: string[] = [];
  holder.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (src && !images.includes(src)) images.push(src);
    // 这里刻意不加 crossorigin="anonymous"：html-to-image 导出时是自己 fetch 图片
    // 再转成 data URL 的，跟 <img> 上有没有这个属性无关；而加上它会让所有不发
    // Access-Control-Allow-Origin 的图床（绝大多数）连预览都显示不出来。
    // 导不进 PNG 的图由 findUnexportableImages() 在导出前探测并提示（FT-IMG-001）。
    img.setAttribute("referrerpolicy", "no-referrer");
    img.setAttribute("loading", "lazy");
  });

  // 外部链接使用安全的打开方式（PRD 10.2）。
  holder.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (/^https?:/i.test(href)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });

  annotateSourceLines(holder, source);

  return {
    html: holder.innerHTML,
    title: extractTitle(holder),
    text: normalizeWhitespace(holder.textContent ?? ""),
    images,
  };
}

/** 顶层块元素上标注它在源码里的起始行，供预览与编辑器的滚动同步定位。 */
export const SOURCE_LINE_ATTRIBUTE = "data-source-line";

/**
 * 给每个顶层块标上源码行号。
 *
 * marked 的顶层 token 与渲染出来的顶层元素是一一对应的，按顺序累加 `raw` 的
 * 行数就能算出每个块从第几行开始。`space`（空行）和 `def`（链接定义）不产生
 * 元素，只占行数。
 *
 * 两边数量对不上说明这个假设在当前文档不成立（例如内联 HTML 展开成了多个
 * 兄弟节点），这时一个都不标：错位的滚动同步比没有同步更让人困惑，调用方
 * 会自动退回按比例滚动。
 */
function annotateSourceLines(holder: HTMLElement, source: string): void {
  let startLines: number[];
  try {
    const tokens = marked.lexer(source);
    startLines = [];
    let line = 1;
    for (const token of tokens) {
      const raw = typeof token.raw === "string" ? token.raw : "";
      if (token.type !== "space" && token.type !== "def") startLines.push(line);
      for (const char of raw) {
        if (char === "\n") line += 1;
      }
    }
  } catch {
    return;
  }

  const blocks = holder.children;
  if (blocks.length !== startLines.length) return;
  for (let index = 0; index < blocks.length; index += 1) {
    blocks[index].setAttribute(SOURCE_LINE_ATTRIBUTE, String(startLines[index]));
  }
}

function extractTitle(holder: HTMLElement): string | null {
  const h1 = holder.querySelector("h1");
  const text = h1?.textContent?.trim();
  return text ? text : null;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * 不依赖 DOM 的标题提取，供 SSR、导出文件名和测试使用。
 * 会跳过围栏代码块内的 `#`，避免把代码注释当成标题。
 */
export function extractTitleFromSource(source: string): string | null {
  let inFence = false;
  let fenceMarker = "";
  for (const line of source.split(/\r?\n/)) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const heading = line.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/);
    if (heading) return heading[1].trim() || null;
  }
  return null;
}

/**
 * 不依赖 DOM 的导语提取：一级标题之后的第一段普通正文，没有一级标题时返回 null。
 * 用来给身份卡片的输入框做占位提示，和渲染层 deriveIdentityCardContent 的兜底口径保持一致。
 */
export function extractLeadParagraphFromSource(source: string): string | null {
  let inFence = false;
  let fenceMarker = "";
  let seenHeading = false;
  for (const line of source.split(/\r?\n/)) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) {
      if (/^#\s/.test(trimmed)) seenHeading = true;
      continue;
    }
    // 引用、列表、表格、分隔线这些块不当成导语。
    if (/^([>\-*+|]|\d+[.)]|-{3,}|_{3,})/.test(trimmed)) continue;
    if (seenHeading) return trimmed;
  }
  return null;
}
