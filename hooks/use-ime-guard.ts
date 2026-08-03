"use client";

import * as React from "react";

/**
 * 输入法组合态守卫。
 *
 * `event.isComposing` 只在组合进行中为真。中文输入法按回车确认候选词时，多数浏览器
 * 先发 compositionend 再发 keydown，到了这次 keydown 上 isComposing 已经是 false，
 * 于是「确认候选词」被当成了「提交」——打完拼音敲回车，标签框直接把半成品存了进去。
 *
 * 所以除了 isComposing，还得认另外两件事：keyCode 229（部分输入法在组合期间把所有
 * 按键都报成它），以及 compositionend 之后的一小段宽限期。
 */

/** 组合结束后的宽限期。够挡住紧随其后那一次 keydown，又短到不会吃掉用户真正的第二次回车。 */
const COMPOSITION_END_GRACE_MS = 50;

/** 组合期间浏览器上报的哨兵键码。 */
const IME_PROCESSING_KEY_CODE = 229;

export interface ImeGuard {
  /** 展开到 `<input>` / `<textarea>` 上，用来跟踪组合态。 */
  compositionProps: {
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
  };
  /** 这次按键是不是输入法在收尾；是的话调用方应当直接返回，不要当成命令。 */
  isComposing: (event: React.KeyboardEvent) => boolean;
}

export function useImeGuard(): ImeGuard {
  const composingRef = React.useRef(false);
  const endedAtRef = React.useRef(Number.NEGATIVE_INFINITY);

  const onCompositionStart = React.useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = React.useCallback(() => {
    composingRef.current = false;
    endedAtRef.current = performance.now();
  }, []);

  const isComposing = React.useCallback((event: React.KeyboardEvent) => {
    if (composingRef.current) return true;
    if (event.nativeEvent.isComposing) return true;
    if (event.nativeEvent.keyCode === IME_PROCESSING_KEY_CODE) return true;
    return performance.now() - endedAtRef.current < COMPOSITION_END_GRACE_MS;
  }, []);

  return React.useMemo(
    () => ({ compositionProps: { onCompositionStart, onCompositionEnd }, isComposing }),
    [isComposing, onCompositionEnd, onCompositionStart],
  );
}
