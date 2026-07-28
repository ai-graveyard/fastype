"use client";

import * as React from "react";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { SOURCE_LINE_ATTRIBUTE } from "@/lib/markdown/parse";

/**
 * 编辑器与预览的双向滚动同步。
 *
 * 预览里的顶层块带着 `data-source-line`（lib/markdown/parse.ts 标的），两边就能
 * 按源码行号互相定位：编辑器停在第 n 行，预览滚到对应的块；反过来也一样。
 * 拿不到标记时（解析器的块划分和 DOM 对不上）本 hook 什么都不做——那种文档
 * 本来也没有可靠的对应关系，宁可不同步，也不要滚到错的地方。
 */

/** 一侧驱动另一侧后的静默期：被动滚动引发的回调不再反向驱动，免得两边互相追。 */
const ECHO_GUARD_MS = 140;

interface BlockMap {
  blocks: HTMLElement[];
  /** 与 blocks 一一对应的源码起始行。 */
  lines: number[];
}

const EMPTY_MAP: BlockMap = { blocks: [], lines: [] };

function collectBlocks(container: HTMLElement): BlockMap {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>(`[${SOURCE_LINE_ATTRIBUTE}]`));
  return {
    blocks,
    lines: blocks.map((block) => Number(block.getAttribute(SOURCE_LINE_ATTRIBUTE)) || 1),
  };
}

/** 块顶部相对滚动容器内容顶部的偏移。 */
function offsetWithin(container: HTMLElement, block: HTMLElement): number {
  return (
    block.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
  );
}

/**
 * 二分找出最后一个满足 `value(i) <= target` 的下标；都不满足时返回 -1。
 * 行号和垂直偏移都是单调递增的，两个方向共用这一个查找。
 */
function findLast(length: number, target: number, value: (index: number) => number): number {
  let low = 0;
  let high = length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (value(mid) <= target) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function useScrollSync(
  editorRef: React.RefObject<EditorApi | null>,
  /** 返回预览的滚动容器；用 useCallback 稳定引用。 */
  getPreviewNode: () => HTMLElement | null,
  enabled: boolean,
  /** 正文变化后重新采集块位置。 */
  contentKey: string,
) {
  const mapRef = React.useRef<BlockMap>(EMPTY_MAP);
  const driverRef = React.useRef<"editor" | "preview" | null>(null);
  const releaseRef = React.useRef(0);
  const frameRef = React.useRef(0);
  // 正文为空时预览渲染的是占位提示，压根没有滚动容器可绑。等它出现了要重绑一次，
  // 但只认「有没有正文」这一步跳变——否则每敲一个字都要解绑重绑一轮监听。
  const hasContent = contentKey.length > 0;

  // 每次滚动都重新查 DOM 太浪费，正文变了才重采一次。块的位置仍是滚动时
  // 实时读的，所以图片加载完把页面撑高也不会错位。
  React.useEffect(() => {
    if (!enabled) {
      mapRef.current = EMPTY_MAP;
      return;
    }
    // 正文刚变完这一帧还没排好版，推到下一帧再采集。
    const frame = requestAnimationFrame(() => {
      const node = getPreviewNode();
      mapRef.current = node ? collectBlocks(node) : EMPTY_MAP;
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, getPreviewNode, contentKey]);

  /**
   * 取当前可用的块表。
   *
   * 正文没变、预览却重新渲染过时（导出会切换 exporting 状态，React 借机重设了
   * 整段 innerHTML），缓存里的节点已经脱离文档——它们的 getBoundingClientRect()
   * 一律返回 0，照着算只会把两边滚到莫名其妙的位置。发现失联就当场重采一次。
   */
  const readMap = React.useCallback((preview: HTMLElement): BlockMap => {
    const cached = mapRef.current;
    if (cached.blocks.length > 0 && cached.blocks[0].isConnected) return cached;
    const fresh = collectBlocks(preview);
    mapRef.current = fresh;
    return fresh;
  }, []);

  React.useEffect(() => {
    if (!enabled || !hasContent) return;
    const editor = editorRef.current;
    const preview = getPreviewNode();
    if (!editor || !preview) return;

    /** 抢到驱动权才动对面，静默期内对面的 scroll 回调直接忽略。 */
    const claim = (side: "editor" | "preview"): boolean => {
      if (driverRef.current && driverRef.current !== side) return false;
      driverRef.current = side;
      window.clearTimeout(releaseRef.current);
      releaseRef.current = window.setTimeout(() => {
        driverRef.current = null;
      }, ECHO_GUARD_MS);
      return true;
    };

    const schedule = (run: () => void) => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(run);
    };

    /** 编辑器行号 → 预览像素。 */
    const editorToPreview = () => {
      const { blocks, lines } = readMap(preview);
      if (blocks.length === 0) return;
      const line = editor.getScrollLine();
      if (line === null) return;

      const index = findLast(lines.length, line, (i) => lines[i]);
      if (index < 0) {
        preview.scrollTop = 0;
        return;
      }

      const top = offsetWithin(preview, blocks[index]);
      const next = blocks[index + 1];
      // 末块没有下一个锚点，按它自己的高度把剩下的行摊开，滚到底时两边同时到底。
      const span = next ? offsetWithin(preview, next) - top : blocks[index].offsetHeight;
      const lineSpan = next ? Math.max(lines[index + 1] - lines[index], 1) : 1;
      preview.scrollTop = top + span * clamp01((line - lines[index]) / lineSpan);
    };

    /** 预览像素 → 编辑器行号。 */
    const previewToEditor = () => {
      const { blocks, lines } = readMap(preview);
      if (blocks.length === 0) return;
      const top = preview.scrollTop;

      // +1 容差：滚动位置常有半像素误差，正好卡在块顶时不该被算到上一块。
      const index = findLast(blocks.length, top + 1, (i) => offsetWithin(preview, blocks[i]));
      if (index < 0) {
        editor.scrollToLine(1);
        return;
      }

      const blockTop = offsetWithin(preview, blocks[index]);
      const next = blocks[index + 1];
      const span = Math.max(
        (next ? offsetWithin(preview, next) : blockTop + blocks[index].offsetHeight) - blockTop,
        1,
      );
      const lineSpan = next ? Math.max(lines[index + 1] - lines[index], 1) : 1;
      editor.scrollToLine(lines[index] + lineSpan * clamp01((top - blockTop) / span));
    };

    const onEditorScroll = () => {
      if (claim("editor")) schedule(editorToPreview);
    };
    const onPreviewScroll = () => {
      if (claim("preview")) schedule(previewToEditor);
    };

    const unsubscribe = editor.subscribeScroll(onEditorScroll);
    preview.addEventListener("scroll", onPreviewScroll, { passive: true });
    return () => {
      unsubscribe();
      preview.removeEventListener("scroll", onPreviewScroll);
      cancelAnimationFrame(frameRef.current);
      window.clearTimeout(releaseRef.current);
      driverRef.current = null;
    };
  }, [editorRef, getPreviewNode, enabled, hasContent, readMap]);
}
