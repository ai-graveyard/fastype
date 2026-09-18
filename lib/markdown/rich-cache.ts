/**
 * 高亮与图表产物的缓存。
 *
 * 小红书那条路会在每次测量前把测量容器的 innerHTML 整个重设一遍，异步渲染出来的
 * SVG 和高亮片段会被一起冲掉；而渲染完成本身就是触发重新测量的原因，于是「渲染完 →
 * 重新测量 → 被冲掉 → 不再重渲染」，图表就永远是空的。
 *
 * 所以产物按源码存一份，重设 innerHTML 之后同步塞回去。同步这点很关键：测量必须在
 * 当前这一帧拿到真实高度，不能再等一轮异步。
 */

/** 图表和高亮产物都不小，分别只保留最近使用的 64 项。 */
const MAX_ENTRIES = 64;

function read<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function put<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = cache.keys().next();
  if (!oldest.done) cache.delete(oldest.value);
}

export interface DiagramCacheEntry {
  html: string;
  /** 占位自己的内联样式（画布比例、图的自然宽度），和产物一起存，否则补回去就没了。 */
  style: string;
}

const diagramCache = new Map<string, DiagramCacheEntry>();
const highlightCache = new Map<string, string>();

export function diagramCacheKey(kind: string, dark: boolean, source: string): string {
  return `${kind}:${dark ? "d" : "l"}:${source}`;
}

export function readDiagramCache(key: string): DiagramCacheEntry | undefined {
  return read(diagramCache, key);
}

export function writeDiagramCache(key: string, entry: DiagramCacheEntry): void {
  put(diagramCache, key, entry);
}

export function highlightCacheKey(language: string, code: string): string {
  return `${language}:${code}`;
}

export function readHighlightCache(key: string): string | undefined {
  return read(highlightCache, key);
}

export function writeHighlightCache(key: string, html: string): void {
  put(highlightCache, key, html);
}

export function __resetRichCachesForTests(): void {
  diagramCache.clear();
  highlightCache.clear();
}
