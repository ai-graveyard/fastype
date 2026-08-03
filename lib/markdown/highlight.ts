/**
 * 代码高亮。
 *
 * highlight.js 只在文档里真的出现带语言标记的代码块时才动态加载。高亮结果用一组
 * 语义 class（`ft-hl-keyword` 之类）表达，而不是 highlight.js 自带的 `hljs-*`：
 * 需要着色的地方共三处，各自的着色方式并不一样——
 *
 * - 编辑器预览、小红书卡片：CSS 规则上色，class 留着就行；
 * - 公众号：所有 class 都会被剥掉换成内联 style（lib/render/wechat.ts），
 *   得按 class 查出颜色写进 style。
 *
 * 收拢成有限的几种语义，就不用为 highlight.js 上百个 scope 各配一份颜色。
 */

import {
  highlightCacheKey,
  readHighlightCache,
  writeHighlightCache,
} from "@/lib/markdown/rich-cache";

/** 代码块的语言名放在这个属性上；marked 默认的 `class="language-x"` 到公众号会被剥掉。 */
export const HIGHLIGHT_LANGUAGE_ATTRIBUTE = "data-lang";

/** 高亮片段的 class 前缀。 */
export const HIGHLIGHT_CLASS_PREFIX = "ft-hl-";

/** 收拢后的语义分类，配色按这几种给。 */
export const HIGHLIGHT_TOKENS = [
  "keyword",
  "string",
  "comment",
  "number",
  "function",
  "type",
  "variable",
  "punctuation",
] as const;
export type HighlightToken = (typeof HIGHLIGHT_TOKENS)[number];

/**
 * highlight.js 的 scope → 我们的语义分类。
 *
 * 表里没有的 scope 会退回 `variable`（普通标识符的颜色），这样新语言引入的冷门 scope
 * 也不会变成没上色的裸文本。
 */
const SCOPE_MAP: Record<string, HighlightToken> = {
  keyword: "keyword",
  built_in: "type",
  literal: "keyword",
  symbol: "variable",
  number: "number",
  regexp: "string",
  string: "string",
  subst: "variable",
  "template-tag": "punctuation",
  "template-variable": "variable",
  comment: "comment",
  doctag: "comment",
  meta: "comment",
  "meta keyword": "keyword",
  "meta string": "string",
  title: "function",
  "title.class": "type",
  "title.class.inherited": "type",
  "title.function": "function",
  "title.function.invoke": "function",
  params: "variable",
  property: "variable",
  attr: "variable",
  attribute: "variable",
  variable: "variable",
  "variable.language": "keyword",
  "variable.constant": "number",
  type: "type",
  class: "type",
  function: "function",
  name: "keyword",
  selector_tag: "keyword",
  "selector-tag": "keyword",
  "selector-id": "function",
  "selector-class": "type",
  "selector-attr": "variable",
  "selector-pseudo": "variable",
  tag: "keyword",
  operator: "punctuation",
  punctuation: "punctuation",
  bullet: "punctuation",
  quote: "comment",
  section: "function",
  link: "string",
  code: "string",
  emphasis: "variable",
  strong: "keyword",
  addition: "string",
  deletion: "comment",
};

export function highlightClass(token: HighlightToken): string {
  return `${HIGHLIGHT_CLASS_PREFIX}${token}`;
}

/** 语言别名统一成 highlight.js 认得的名字；不认识的语言返回空串，那就不高亮。 */
export function normalizeCodeLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  if (!value) return "";
  // 只允许字母数字和常见分隔符，避免把任意字符串写进 HTML 属性。
  return /^[a-z0-9+#._-]{1,24}$/.test(value) ? value : "";
}

interface HighlightModule {
  highlight: (
    code: string,
    options: { language: string; ignoreIllegals?: boolean },
  ) => { value: string };
  getLanguage: (name: string) => unknown;
}

let modulePromise: Promise<HighlightModule> | null = null;

/** highlight.js 只加载一次，且只在真的有代码块时才加载。 */
async function loadHighlighter(): Promise<HighlightModule> {
  modulePromise ??= import("highlight.js/lib/common").then(
    (module) => (module.default ?? module) as unknown as HighlightModule,
  );
  return modulePromise;
}

/** 把 highlight.js 输出里的 `hljs-*` class 换成我们的语义 class。 */
function mapScopeClasses(html: string): string {
  return html.replace(/class="hljs-([^"]+)"/g, (_match, scopes: string) => {
    const scope = scopes.trim();
    const token = SCOPE_MAP[scope] ?? SCOPE_MAP[scope.split(" ")[0]] ?? "variable";
    return `class="${highlightClass(token)}"`;
  });
}

/** 已上色的标记，避免重复处理。 */
const DONE_ATTRIBUTE = "data-highlighted";

function pendingBlocks(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      `code[${HIGHLIGHT_LANGUAGE_ATTRIBUTE}]:not([${DONE_ATTRIBUTE}])`,
    ),
  );
}

/**
 * 给容器里所有带语言标记的代码块上色。
 *
 * 已经上过色的会跳过，所以重复调用是安全的——预览重渲染时只有新出现的代码块会被处理。
 * 返回实际处理了几块，调用方据此决定要不要重新测量分页。
 */
export async function highlightCodeBlocks(root: HTMLElement): Promise<number> {
  const blocks = pendingBlocks(root);
  if (blocks.length === 0) return 0;

  const hljs = await loadHighlighter();
  let done = 0;
  for (const block of blocks) {
    const language = block.getAttribute(HIGHLIGHT_LANGUAGE_ATTRIBUTE) ?? "";
    const code = block.textContent ?? "";
    // 先打标记：语言不支持时也别在下一轮重新排队。
    block.setAttribute(DONE_ATTRIBUTE, "true");
    if (!language || !hljs.getLanguage(language)) continue;
    try {
      // 输入是 textContent（纯文本），highlight.js 会把它转义后再包 span，
      // 产物只有 span 和文本，不存在需要再消毒的外来 HTML。
      const { value } = hljs.highlight(code, { language, ignoreIllegals: true });
      const html = mapScopeClasses(value);
      block.innerHTML = html;
      writeHighlightCache(highlightCacheKey(language, code), html);
      done += 1;
    } catch {
      // 高亮失败就保持原样的纯文本，不影响这段代码本身的显示。
    }
  }
  return done;
}

/**
 * 用缓存同步补回高亮，不加载 highlight.js。
 *
 * 给「刚重设过 innerHTML、马上就要测量」的场景用；缓存没命中的代码块留给
 * highlightCodeBlocks 走异步那条路。
 */
export function replayHighlight(root: HTMLElement): number {
  let done = 0;
  for (const block of pendingBlocks(root)) {
    const language = block.getAttribute(HIGHLIGHT_LANGUAGE_ATTRIBUTE) ?? "";
    const cached = readHighlightCache(highlightCacheKey(language, block.textContent ?? ""));
    if (cached === undefined) continue;
    block.innerHTML = cached;
    block.setAttribute(DONE_ATTRIBUTE, "true");
    done += 1;
  }
  return done;
}
