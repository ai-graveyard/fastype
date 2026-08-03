/**
 * 导出 PNG 时把用到的自托管字体内联进去。
 *
 * html-to-image 需要字体以 data URI 的形式出现在样式里，否则截出来的图会退回默认字体。
 * 但它自带的字体内联是「把页面上所有 @font-face 都抓一遍」——行楷按 unicode-range 切成了
 * 一百多片，全抓一次就是几 MB 的无谓请求，每导出一页付一次。
 *
 * 所以这里自己算：浏览器已经按 unicode-range 只下载了正文真正用到的那几片，
 * `performance` 的资源记录里就写着是哪几片，照着那份名单内联就够了。
 *
 * 只处理同源字体。系统字体不需要内联，第三方字体本项目也不引。
 */

/** 一次导出算一遍就够；同一篇文档的多页共用同一份。 */
let cache: { key: string; css: string } | null = null;

function loadedFontUrls(): string[] {
  if (typeof performance === "undefined") return [];
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType("resource")) {
    if (/\.woff2?(\?|$)/i.test(entry.name)) urls.add(entry.name);
  }
  return [...urls];
}

function sameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * `@font-face` 里的地址是相对样式表写的（打包后的 CSS 里是 `../media/xxx.woff2`），
 * 基准得取样式表自己的地址，拿页面地址去解会少一层目录、对不上已下载的那份。
 */
function resolveFontUrl(url: string, rule: CSSFontFaceRule): string | null {
  const base = rule.parentStyleSheet?.href ?? window.location.href;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 遍历同源样式表里的 @font-face；跨域样式表读 cssRules 会抛异常，跳过。 */
function fontFaceRules(): CSSFontFaceRule[] {
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(window.document.styleSheets)) {
    let sheetRules: CSSRuleList;
    try {
      sheetRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(sheetRules)) {
      if (rule instanceof CSSFontFaceRule) rules.push(rule);
    }
  }
  return rules;
}

const URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/**
 * 生成只含已加载分片的 `@font-face` CSS，交给 html-to-image 的 `fontEmbedCSS`。
 *
 * 页面上没用到任何自托管字体时返回空串——那种情况下调用方应该继续走 `skipFonts`，
 * 省掉一整轮不会有结果的扫描。
 */
export async function buildUsedFontEmbedCss(): Promise<string> {
  if (typeof window === "undefined") return "";

  const loaded = loadedFontUrls().filter(sameOrigin);
  if (loaded.length === 0) return "";

  const key = loaded.slice().sort().join("|");
  if (cache?.key === key) return cache.css;

  const loadedSet = new Set(loaded);
  const blocks: string[] = [];

  for (const rule of fontFaceRules()) {
    const src = rule.style.getPropertyValue("src");
    if (!src) continue;

    // 一条 src 里可能同时写了 woff2 和 woff；只要其中一个分片被下载过，这条就该内联。
    const replacements = new Map<string, string>();
    URL_PATTERN.lastIndex = 0;
    for (let match = URL_PATTERN.exec(src); match; match = URL_PATTERN.exec(src)) {
      const absolute = resolveFontUrl(match[2], rule);
      if (!absolute || !loadedSet.has(absolute)) continue;
      const dataUrl = await fetchAsDataUrl(absolute);
      if (dataUrl) replacements.set(match[0], `url(${dataUrl})`);
    }
    if (replacements.size === 0) continue;

    let text = rule.cssText;
    for (const [from, to] of replacements) text = text.replace(from, to);
    // 没被下载的那些格式还挂着相对地址，留着只会让 html-to-image 再去抓一次。
    text = text.replace(/,?\s*url\((?!data:)[^)]*\)\s*format\([^)]*\)/g, "");
    blocks.push(text);
  }

  const css = blocks.join("\n");
  cache = { key, css };
  return css;
}

/** 文档换了、字体换了都可能改变用到的分片，导出前清一次缓存最省心。 */
export function clearFontEmbedCache(): void {
  cache = null;
}
