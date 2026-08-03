import {
  DIAGRAM_KIND_ATTRIBUTE,
  DIAGRAM_SOURCE_ATTRIBUTE,
  DIAGRAM_STATE_ATTRIBUTE,
  DIAGRAM_WIDTH_VARIABLE,
  decodeDiagramSource,
  isDiagramKind,
  type DiagramKind,
} from "@/lib/markdown/diagram";
import { diagramCacheKey, readDiagramCache, writeDiagramCache } from "@/lib/markdown/rich-cache";

/**
 * 把图表占位渲染成 SVG。
 *
 * mermaid 和 markmap 都是几百 KB，只在文档里真的出现对应代码块时才动态 import，
 * 而且各自只加载一次。渲染结果直接写进占位节点，之后小红书分页会重新测量高度。
 */

/** markmap 没有内容高度的概念，给个 16:10 的画布；太扁的思维导图分支会挤在一起。 */
const MARKMAP_ASPECT = 0.62;
/** 后台标签页里 requestAnimationFrame 不触发，等这么久就往下走。 */
const FRAME_FALLBACK_MS = 50;

export interface DiagramRenderOptions {
  /** 深色底上要用深色主题，否则线条和文字会糊在背景里。 */
  dark?: boolean;
}

interface MermaidModule {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
}

let mermaidPromise: Promise<MermaidModule> | null = null;
let mermaidTheme: "default" | "dark" | null = null;
let mermaidSeq = 0;

async function loadMermaid(dark: boolean): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid").then(
    (module) => (module.default ?? module) as unknown as MermaidModule,
  );
  const mermaid = await mermaidPromise;
  const theme = dark ? "dark" : "default";
  // initialize 是全局的，主题变了才重来一次。
  if (mermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      // 图表源码同样来自用户文档，按不可信内容处理。
      securityLevel: "strict",
      fontFamily: "inherit",
    });
    mermaidTheme = theme;
  }
  return mermaid;
}

interface MarkmapModule {
  Transformer: new () => { transform: (source: string) => { root: unknown } };
  Markmap: {
    create: (svg: SVGSVGElement, options: Record<string, unknown> | null, data: unknown) => unknown;
  };
}

let markmapPromise: Promise<MarkmapModule> | null = null;

async function loadMarkmap(): Promise<MarkmapModule> {
  markmapPromise ??= Promise.all([import("markmap-lib"), import("markmap-view")]).then(
    ([lib, view]) =>
      ({
        Transformer: lib.Transformer,
        Markmap: view.Markmap,
      }) as unknown as MarkmapModule,
  );
  return markmapPromise;
}

/** 渲染失败时把源码原样摆出来，至少内容没丢。 */
function renderFailure(host: HTMLElement, source: string, message: string): void {
  host.setAttribute(DIAGRAM_STATE_ATTRIBUTE, "error");
  const pre = window.document.createElement("pre");
  const code = window.document.createElement("code");
  code.textContent = source;
  pre.appendChild(code);
  const note = window.document.createElement("p");
  note.className = "ft-diagram-error";
  note.textContent = message;
  host.replaceChildren(note, pre);
}

async function renderMermaid(host: HTMLElement, source: string, dark: boolean): Promise<void> {
  const mermaid = await loadMermaid(dark);
  mermaidSeq += 1;
  const { svg } = await mermaid.render(`ft-mermaid-${mermaidSeq}`, source);
  host.innerHTML = svg;
  const rendered = host.querySelector<SVGSVGElement>("svg");
  if (rendered) {
    /*
     * mermaid 把图的自然宽度写成内联 `max-width: <n>px`。内联样式压过任何 CSS 规则，
     * 留着它三个视图就只能用同一个尺寸——而它们要的并不一样：编辑器预览按自然尺寸摆
     * 最自然，小红书卡片是 1080 宽给手机看的，那点尺寸摆上去只有指甲盖大。
     * 所以把自然宽度挪进 CSS 变量交给样式表，各视图自己决定用不用。
     */
    const naturalWidth = rendered.style.maxWidth;
    if (naturalWidth) host.style.setProperty(DIAGRAM_WIDTH_VARIABLE, naturalWidth);
    rendered.style.removeProperty("max-width");
    rendered.style.removeProperty("width");
  }
}

async function renderMarkmap(host: HTMLElement, source: string): Promise<void> {
  const { Transformer, Markmap } = await loadMarkmap();
  const { root } = new Transformer().transform(source);

  const svg = window.document.createElementNS("http://www.w3.org/2000/svg", "svg");
  /*
   * 画布高度用 aspect-ratio 跟着宽度走，svg 靠样式表里那条 !important 撑满 host。
   *
   * 不写死像素：宽度是分栏拖出来的，量早了会拿到一个很小的中间值，钉成像素之后
   * 就再也回不来了。也不能把高度写在 svg 的内联 style 上——markmap 会读 svg 的
   * clientHeight 算缩放，再把量到的值回写进那个 style，写多少都会被它改掉；量到 0
   * 时它退回一个 64×40 的默认画布，整张图缩成一小块再溢出容器。
   */
  host.style.aspectRatio = `1 / ${MARKMAP_ASPECT}`;
  svg.style.display = "block";
  host.replaceChildren(svg);
  // 让浏览器先给这个 svg 完成一次布局。紧接着 create 的话它量到的还是 0。
  await nextFrame();

  const markmap = Markmap.create(
    svg,
    { autoFit: true, duration: 0, fitRatio: 0.92, pan: false, zoom: false },
    root,
  ) as { fit?: () => Promise<void> | void };
  // 收一次让内容落进画布。这里刻意不 await：fit 内部是动画驱动的，
  // 在离屏容器里它的 promise 不一定会 settle，await 下去整个占位就永远停在 pending。
  // 画布高度是上面写死的，不 await 也不会影响分页测量。
  void markmap.fit?.();

  // 分栏拖动会改变画布宽度，收一次的结果就不再合适了。节点从 DOM 移除后
  // ResizeObserver 自然停止回调，这里不额外维护生命周期。
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => void markmap.fit?.()).observe(host);
  }
}

/**
 * 等一帧。
 *
 * 标签页在后台时 requestAnimationFrame 不会触发，所以配一个定时器兜底——
 * 否则后台标签里的一次导出会永远停在这里。
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, FRAME_FALLBACK_MS);
  });
}

async function renderOne(
  host: HTMLElement,
  kind: DiagramKind,
  source: string,
  options: DiagramRenderOptions,
  errorMessage: string,
): Promise<boolean> {
  const dark = options.dark ?? false;
  try {
    if (kind === "mermaid") await renderMermaid(host, source, dark);
    else await renderMarkmap(host, source);
    host.setAttribute(DIAGRAM_STATE_ATTRIBUTE, "done");
    // 存产物而不是重画：测量容器随时会被重设 innerHTML，那时得同步补回来。
    writeDiagramCache(diagramCacheKey(kind, dark, source), {
      html: host.innerHTML,
      style: host.getAttribute("style") ?? "",
    });
    return true;
  } catch {
    renderFailure(host, source, errorMessage);
    return true;
  }
}

/** 找出还没渲染过的图表占位。 */
function pendingHosts(root: HTMLElement): HTMLElement[] {
  // 按属性而不是 class 找：公众号那条路会把所有 class 剥掉换成内联样式。
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      `[${DIAGRAM_KIND_ATTRIBUTE}]:not([${DIAGRAM_STATE_ATTRIBUTE}])`,
    ),
  );
}

/**
 * 用缓存同步补回图表，不加载 mermaid / markmap。
 *
 * 给「刚重设过 innerHTML、马上就要测量」的场景用；没命中的占位留给 renderDiagrams
 * 走异步那条路。
 */
export function replayDiagrams(root: HTMLElement, options: DiagramRenderOptions = {}): number {
  const dark = options.dark ?? false;
  let done = 0;
  for (const host of pendingHosts(root)) {
    const kind = host.getAttribute(DIAGRAM_KIND_ATTRIBUTE) ?? "";
    const source = decodeDiagramSource(host.getAttribute(DIAGRAM_SOURCE_ATTRIBUTE) ?? "");
    if (!isDiagramKind(kind)) continue;
    const cached = readDiagramCache(diagramCacheKey(kind, dark, source));
    if (cached === undefined) continue;
    host.innerHTML = cached.html;
    // 画布比例和图的自然宽度都在这条内联样式里，跟着产物一起补回来。
    if (cached.style) host.setAttribute("style", cached.style);
    host.setAttribute(DIAGRAM_STATE_ATTRIBUTE, "done");
    done += 1;
  }
  return done;
}

/**
 * 渲染容器里所有还没处理过的图表占位。
 *
 * 已渲染的会跳过，重复调用是安全的。返回处理了几个，调用方据此决定要不要重新测量。
 */
export async function renderDiagrams(
  root: HTMLElement,
  errorMessage: string,
  options: DiagramRenderOptions = {},
): Promise<number> {
  const hosts = pendingHosts(root);
  if (hosts.length === 0) return 0;

  const jobs = hosts.map(async (host) => {
    const kind = host.getAttribute(DIAGRAM_KIND_ATTRIBUTE) ?? "";
    const source = decodeDiagramSource(host.getAttribute(DIAGRAM_SOURCE_ATTRIBUTE) ?? "");
    if (!isDiagramKind(kind) || !source.trim()) {
      host.setAttribute(DIAGRAM_STATE_ATTRIBUTE, "done");
      return false;
    }
    // 先占位，避免同一个节点在下一轮再排一次队。
    host.setAttribute(DIAGRAM_STATE_ATTRIBUTE, "pending");
    return renderOne(host, kind, source, options, errorMessage);
  });

  const results = await Promise.all(jobs);
  return results.filter(Boolean).length;
}
