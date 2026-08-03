"use client";

import * as React from "react";

import { highlightCodeBlocks, replayHighlight } from "@/lib/markdown/highlight";
import { renderDiagrams, replayDiagrams } from "@/lib/markdown/render-diagram";

/**
 * 代码高亮与图表渲染这两步「渲染后增强」。
 *
 * 两者都要动态 import 一个不小的库，做不到跟 Markdown 解析一起同步完成，于是走的是
 * 和图片一样的路子：先把内容摆上去，异步补齐，补完让小红书重新测量分页。
 *
 * 但两者补的位置不一样：
 *
 * - **高亮**补在 HTML 字符串上。公众号那条路要把 class 换算成内联颜色（微信不认
 *   class），换算发生在 renderWechat 里，所以高亮必须在喂给它之前就完成。
 * - **图表**补在各视图自己的 DOM 上。markmap 的画布尺寸取自容器宽度，而三个视图的
 *   容器一个比一个不一样宽，没法共用一份产物。
 */

/** 从缓存同步补一遍高亮，命中不了就原样返回。 */
function highlightFromCache(html: string): string {
  if (!html || typeof window === "undefined") return html;
  const holder = window.document.createElement("div");
  holder.innerHTML = html;
  return replayHighlight(holder) > 0 ? holder.innerHTML : html;
}

/**
 * 给 HTML 里的代码块上色。
 *
 * 返回的字符串一开始可能还没上色（highlight.js 要先加载），上完色会再返回一次。
 * 文档切换时先用缓存同步补一版，避免代码块闪一下黑白再变彩色。
 */
export function useHighlightedHtml(html: string): string {
  const fromCache = React.useMemo(() => highlightFromCache(html), [html]);
  const [state, setState] = React.useState({ source: html, value: fromCache });

  // 正文变了就先切回同步那一版，别把上一篇的高亮结果留在屏幕上。
  if (state.source !== html) setState({ source: html, value: fromCache });

  React.useEffect(() => {
    if (!html) return;
    let alive = true;
    const holder = window.document.createElement("div");
    holder.innerHTML = html;
    void highlightCodeBlocks(holder).then((count) => {
      if (alive && count > 0) setState({ source: html, value: holder.innerHTML });
    });
    return () => {
      alive = false;
    };
  }, [html]);

  return state.value;
}

/**
 * 用缓存同步补回已经渲染过的图表。
 *
 * 给「刚重设过 innerHTML、这一帧就要测量」的调用方用（小红书的测量容器）。
 * 缓存没命中的部分由 useDiagrams 走异步补上。
 */
export function replayRichBlocks(root: HTMLElement, dark = false): number {
  return replayDiagrams(root, { dark });
}

/** 渲染容器里的图表占位；返回值变化即表示有图画好了，需要重新测量。 */
export function useDiagrams(
  containerRef: React.RefObject<HTMLElement | null>,
  html: string,
  options: { dark?: boolean; diagramErrorLabel: string },
): number {
  const [tick, setTick] = React.useState(0);
  const { dark = false, diagramErrorLabel } = options;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    void renderDiagrams(container, diagramErrorLabel, { dark }).then((count) => {
      if (alive && count > 0) setTick((value) => value + 1);
    });

    return () => {
      alive = false;
    };
  }, [containerRef, dark, diagramErrorLabel, html]);

  return tick;
}
