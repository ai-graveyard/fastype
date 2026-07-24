"use client";

import * as React from "react";

/** 预览更新前的防抖，避免每次按键都重新解析 Markdown（PRD FT-EDT-003 / 12.1）。 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** 稳定引用的回调，供事件监听和定时器使用。 */
export function useEvent<Args extends unknown[], Return>(
  handler: (...args: Args) => Return,
): (...args: Args) => Return {
  const ref = React.useRef(handler);
  React.useInsertionEffect(() => {
    ref.current = handler;
  });
  return React.useCallback((...args: Args) => ref.current(...args), []);
}
