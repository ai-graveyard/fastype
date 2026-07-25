import DOMPurify from "dompurify";
import { Marked } from "marked";

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
    ADD_ATTR: ["target", "rel"],
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

  return {
    html: holder.innerHTML,
    title: extractTitle(holder),
    text: normalizeWhitespace(holder.textContent ?? ""),
    images,
  };
}

function extractTitle(holder: HTMLElement): string | null {
  const h1 = holder.querySelector("h1");
  const text = h1?.textContent?.trim();
  return text ? text : null;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();
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
