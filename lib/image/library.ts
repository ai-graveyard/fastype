/**
 * 图片库：正文里的引用（lib/image/ref.ts）与 IndexedDB 里的图片本体（lib/image/db.ts）之间的那一层。
 *
 * 渲染这条路必须是同步的——renderMarkdown 是纯函数，三个视图都靠它的返回值算分页、
 * 算字数、算导出。所以这里在内存里留一份 id → data URI 的会话缓存：异步从 IndexedDB
 * 读一次，之后 resolveImageRefs 直接同步换出来。
 *
 * 为什么换成 data URI 而不是 `URL.createObjectURL` 的 blob 地址：
 * - 消毒层（DOMPurify）默认白名单里没有 blob 协议，img 的 src 会被整个剥掉，只有
 *   data: 有专门的放行分支。为了显示图片去放宽消毒规则，不值得。
 * - 导出 HTML、复制到公众号、打印这几条路产出的东西要离开本页面，blob 地址一出这个
 *   会话就是死链，最后还是得挨个换回 data URI。
 * 内存占用和以前把 base64 直接写在正文里是一样的，真正省下来的是 localStorage 配额、
 * 编辑器里那些十几万字符的长行，以及每 3 秒一次的自动保存。
 */

import {
  blobToDataUrl,
  dataUrlByteLength,
  dataUrlToBlob,
  isImageDataUrl,
  TRANSPARENT_PIXEL,
} from "@/lib/image/data-url";
import {
  clearImages,
  deleteImages,
  isImageDbAvailable,
  listImageStamps,
  putImage,
  readImage,
} from "@/lib/image/db";
import {
  buildImageRef,
  findImageRefIds,
  findMarkdownImageTargets,
  imageRefId,
  newImageId,
  replaceImageRefs,
  replaceMarkdownImageTargets,
} from "@/lib/image/ref";

export interface ImageInfo {
  bytes: number;
  type: string;
  width: number;
  height: number;
}

const dataUrls = new Map<string, string>();
const DEFAULT_IMAGE_CACHE_LIMIT_BYTES = 24 * 1024 * 1024;
let imageCacheLimitBytes = DEFAULT_IMAGE_CACHE_LIMIT_BYTES;
let imageCacheBytes = 0;
const pins = new Map<string, number>();
/**
 * 反查：data URI → id。
 *
 * 设置里的头像、封面对外给出的是解析后的 data URI，用户改个昵称再保存，回来的就是同一张
 * 图的 data URI。没有这张反查表，每保存一次就往库里塞一份一模一样的图。键用的是 dataUrls
 * 里那同一个字符串，多的只是一条 Map 记录。
 */
const byDataUrl = new Map<string, string>();
const infos = new Map<string, ImageInfo>();
/** 查过库、确实没有的 id。记下来才不会对着一张丢了的图反复发请求。 */
const absent = new Set<string>();
/** 同一个 id 的并发读取合并成一次。 */
const loading = new Map<string, Promise<void>>();
/** 同一份 data URI 的并发写入合并成一次，避免设置迁移与用户保存各存一份。 */
const saving = new Map<string, Promise<string | null>>();

function dropFromCache(id: string): void {
  const dataUrl = dataUrls.get(id);
  if (!dataUrl) return;
  if (byDataUrl.get(dataUrl) === id) byDataUrl.delete(dataUrl);
  dataUrls.delete(id);
  const info = infos.get(id);
  if (info) imageCacheBytes = Math.max(0, imageCacheBytes - info.bytes);
  infos.delete(id);
}

function touch(id: string): string | null {
  const dataUrl = dataUrls.get(id);
  if (!dataUrl) return null;
  dataUrls.delete(id);
  dataUrls.set(id, dataUrl);
  return dataUrl;
}

function trimImageCache(): void {
  if (imageCacheBytes <= imageCacheLimitBytes) return;
  for (const id of dataUrls.keys()) {
    if (imageCacheBytes <= imageCacheLimitBytes) break;
    if ((pins.get(id) ?? 0) > 0) continue;
    dropFromCache(id);
  }
}

function remember(id: string, dataUrl: string, width: number, height: number): void {
  dropFromCache(id);
  const info = {
    bytes: dataUrlByteLength(dataUrl),
    type: dataUrl.slice(5, Math.max(5, dataUrl.indexOf(";"))),
    width,
    height,
  };
  dataUrls.set(id, dataUrl);
  byDataUrl.set(dataUrl, id);
  infos.set(id, info);
  imageCacheBytes += info.bytes;
  absent.delete(id);
  trimImageCache();
}

/** 已经在缓存里的 data URI；没有就返回 null，调用方按需 loadImages 之后再来。 */
export function peekImageDataUrl(id: string): string | null {
  return touch(id);
}

export function peekImageInfo(id: string): ImageInfo | null {
  touch(id);
  return infos.get(id) ?? null;
}

/**
 * 当前渲染链正在使用的图片不能被 LRU 淘汰。返回的释放函数应在组件换文档或卸载时调用。
 */
export function pinImages(ids: Iterable<string>): () => void {
  const unique = [...new Set(ids)];
  for (const id of unique) pins.set(id, (pins.get(id) ?? 0) + 1);
  return () => {
    for (const id of unique) {
      const count = pins.get(id) ?? 0;
      if (count <= 1) pins.delete(id);
      else pins.set(id, count - 1);
    }
    trimImageCache();
  };
}

/** 把一张已编码好的图片收进库里，返回可以写进正文的引用。存不进去时返回 null。 */
export async function saveImage(blob: Blob, width: number, height: number): Promise<string | null> {
  if (!isImageDbAvailable()) return null;
  const id = newImageId();
  let ok = false;
  try {
    ok = await putImage({
      id,
      data: await blob.arrayBuffer(),
      type: blob.type,
      width,
      height,
      createdAt: Date.now(),
    });
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    remember(id, await blobToDataUrl(blob), width, height);
  } catch {
    // 缓存没种上不影响已经落库的图，下次 loadImages 会再读一遍。
  }
  return buildImageRef(id);
}

/** 把 data URI 形态的图片收进库里（打开文件、迁移旧草稿、裁剪结果都走这条）。 */
export async function saveImageDataUrl(
  dataUrl: string,
  width = 0,
  height = 0,
): Promise<string | null> {
  // 这一张已经在库里了就复用，别存第二份。
  const known = byDataUrl.get(dataUrl);
  if (known) {
    touch(known);
    return buildImageRef(known);
  }
  const inFlight = saving.get(dataUrl);
  if (inFlight) return inFlight;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  const task = saveImage(blob, width, height).finally(() => {
    if (saving.get(dataUrl) === task) saving.delete(dataUrl);
  });
  saving.set(dataUrl, task);
  return task;
}

/** 把这些 id 读进会话缓存；读不到的记进 absent，不重复查。 */
export async function loadImages(ids: string[]): Promise<void> {
  const wanted = ids.filter((id) => !dataUrls.has(id) && !absent.has(id));
  await Promise.all(
    wanted.map((id) => {
      const inFlight = loading.get(id);
      if (inFlight) return inFlight;
      const task = readImage(id)
        .then(async (result) => {
          // 暂时开不了库不等于图片不存在；不记 absent，后续调用还能重试。
          if (!result.ok) return;
          if (!result.record) {
            absent.add(id);
            return;
          }
          const record = result.record;
          const blob = new Blob([record.data], { type: record.type });
          remember(id, await blobToDataUrl(blob), record.width, record.height);
        })
        .catch(() => {})
        .finally(() => loading.delete(id));
      loading.set(id, task);
      return task;
    }),
  );
}

/**
 * 正文里的引用换成 data URI，供渲染使用。
 *
 * 还在读的图先给一个透明占位：这一步是同步的，第一帧多半还没读完，留着引用会让消毒层
 * 剥掉 src，预览里闪一片「图片加载失败」。确认库里没有的才留着引用，让那套既有提示接手。
 */
export function resolveImageRefs(source: string): string {
  return replaceImageRefs(source, (id) => {
    const cached = touch(id);
    if (cached) return cached;
    return absent.has(id) ? null : TRANSPARENT_PIXEL;
  });
}

/** 设置里的单值图片字段不是 Markdown；显式 API 避免把严格正文替换放宽到普通文字。 */
export function resolveImageRefValue(value: string): string {
  const id = imageRefId(value);
  if (!id) return value;
  const cached = touch(id);
  if (cached) return cached;
  return absent.has(id) ? value : TRANSPARENT_PIXEL;
}

/**
 * 引用换回 data URI，得到一份自包含的 Markdown。
 *
 * 下载、写回文件、复制全文都走这里：落到 FasType 之外的东西不能带着只有本机
 * IndexedDB 认识的引用（PRD「一篇 Markdown，写完就能带走」）。
 */
export interface InlineImageRefsResult {
  content: string;
  /** 无法从 IndexedDB 取出的引用，调用方必须阻止不完整导出。 */
  unresolvedIds: string[];
}

export async function inlineImageRefsStrict(source: string): Promise<InlineImageRefsResult> {
  // 兼容头像、封面这类「整个字段就是一条引用」的旧调用；正文替换仍严格限于图片目标。
  const singleId = imageRefId(source);
  const ids = singleId ? [singleId] : findImageRefIds(source);
  if (ids.length === 0) return { content: source, unresolvedIds: [] };
  const release = pinImages(ids);
  try {
    await loadImages(ids);
    const unresolvedIds = ids.filter((id) => !dataUrls.has(id));
    const content = singleId
      ? (touch(singleId) ?? source)
      : replaceImageRefs(source, (id) => touch(id));
    return { content, unresolvedIds };
  } finally {
    release();
  }
}

/** 兼容现有调用方；需要阻止不完整导出时改用 inlineImageRefsStrict。 */
export async function inlineImageRefs(source: string): Promise<string> {
  return (await inlineImageRefsStrict(source)).content;
}

export interface ImportResult {
  content: string;
  /** 成功搬进 IndexedDB 的图片数。 */
  imported: number;
  /** 存不进去、只能继续内嵌在正文里的图片数。 */
  skipped: number;
}

/**
 * 把正文里内嵌的 data URI 搬进 IndexedDB，换成引用。
 *
 * 三处入口：打开外部 Markdown、迁移升级前存下的旧草稿、用户直接粘进来一段带图的
 * Markdown。存不进去的原样留着——内嵌图片这条老路一直是能用的，只是费配额。
 */
export async function importDataUrls(source: string): Promise<ImportResult> {
  const found = findMarkdownImageTargets(source)
    .map((target) => target.value)
    .filter(isImageDataUrl);
  if (found.length === 0) return { content: source, imported: 0, skipped: 0 };

  const refs = new Map<string, string>();
  let skipped = 0;
  // 同一张图在正文里出现多次只存一份。
  for (const dataUrl of new Set(found)) {
    const ref = await saveImageDataUrl(dataUrl);
    if (ref) refs.set(dataUrl, ref);
    else skipped += 1;
  }
  if (refs.size === 0) return { content: source, imported: 0, skipped };

  const content = replaceMarkdownImageTargets(source, (target) => refs.get(target) ?? null);
  return { content, imported: refs.size, skipped };
}

function forget(ids: Iterable<string>): void {
  for (const id of ids) {
    dropFromCache(id);
    pins.delete(id);
    absent.add(id);
  }
}

/**
 * 删掉已经没人引用的图片。
 *
 * `sources` 要囊括所有可能提到图片的地方——正文、头像、公众号封面。少给一处，那一处的图
 * 就会被当成没人要的清掉。调用方直接把 localStorage 里各条记录的原文塞进来即可，
 * 引用的格式在哪种记录里都一样，不需要按结构逐个字段翻。
 *
 * 只在启动时扫一次，而且放过刚存进去不久的：编辑期间删一张图还能撤销回来，当场清掉
 * 库里的本体，撤销之后刷新页面图就没了。启动时没有撤销历史，这时候清最安全；宽限期
 * 兜的是另一种情况——另一个标签页刚插进去的图还没来得及写进本地记录。
 */
const SWEEP_GRACE_MS = 60_000;

export async function sweepUnusedImages(sources: string[]): Promise<number> {
  if (!isImageDbAvailable()) return 0;
  const used = new Set(sources.flatMap(findReferencedImageIds));
  const deadline = Date.now() - SWEEP_GRACE_MS;
  const stale = (await listImageStamps())
    .filter((stamp) => !used.has(stamp.id) && stamp.createdAt < deadline)
    .map((stamp) => stamp.id);
  if (stale.length === 0) return 0;
  if (!(await deleteImages(stale))) return 0;
  forget(stale);
  return stale.length;
}

/** 删掉指定的几张图（清除草稿时连带清掉正文里的插图）。 */
export async function forgetImages(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  if (!(await deleteImages(ids))) return false;
  forget(ids);
  return true;
}

/** 清空图片库（清除全部数据时用）。 */
export async function forgetAllImages(): Promise<boolean> {
  if (!(await clearImages())) return false;
  dataUrls.clear();
  byDataUrl.clear();
  infos.clear();
  absent.clear();
  pins.clear();
  imageCacheBytes = 0;
  return true;
}

/** 仅供测试使用：清掉会话缓存，不动库。 */
export function __resetImageCacheForTests(): void {
  dataUrls.clear();
  byDataUrl.clear();
  infos.clear();
  absent.clear();
  loading.clear();
  saving.clear();
  pins.clear();
  imageCacheBytes = 0;
  imageCacheLimitBytes = DEFAULT_IMAGE_CACHE_LIMIT_BYTES;
}

/** 仅供测试使用：把上限压低，验证 LRU 与 pin 行为。 */
export function __setImageCacheLimitForTests(bytes: number): void {
  imageCacheLimitBytes = Math.max(0, bytes);
  trimImageCache();
}

function findReferencedImageIds(source: string): string[] {
  const ids = findImageRefIds(source);
  const direct = imageRefId(source);
  if (direct && !ids.includes(direct)) ids.push(direct);

  try {
    collectJsonImageRefs(JSON.parse(source) as unknown, ids);
  } catch {
    // 正文通常不是 JSON；只把它按 Markdown 扫一遍即可。
  }
  return ids;
}

function collectJsonImageRefs(value: unknown, ids: string[]): void {
  if (typeof value === "string") {
    const id = imageRefId(value);
    if (id && !ids.includes(id)) ids.push(id);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonImageRefs(item, ids);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const item of Object.values(value)) collectJsonImageRefs(item, ids);
}
