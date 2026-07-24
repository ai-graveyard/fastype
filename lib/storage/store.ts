import { readRecord, removeRecord, writeRecord, type WriteResult } from "./index";

/**
 * localStorage 支撑的外部状态源。
 *
 * 用 useSyncExternalStore 订阅，而不是「useState + useEffect 里读一次再 setState」：
 * 客户端首帧就能拿到真实值，不会多一轮级联渲染，也不会闪一下默认主题。
 */
export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  /** 静态导出时服务端没有 localStorage，一律返回默认值。 */
  getServerSnapshot: () => T;
  set: (value: T) => void;
  /** 写盘但不通知订阅者：用于高频自动保存，避免每次都触发重渲染。 */
  setQuiet: (value: T) => WriteResult;
  reset: () => void;
  /** 本地是否真的存过（用来区分「首次访问」和「用户存了默认值」）。 */
  isFound: () => boolean;
}

export function createLocalStore<T>(
  key: string,
  parse: (raw: unknown) => T | null,
  fallback: T,
  /** 首次访问（本地没有记录）时的初始值，例如按浏览器语言推断。 */
  onFirstVisit?: (fallback: T) => T,
): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cache: T | null = null;
  let found = false;

  const load = (): T => {
    if (cache !== null) return cache;
    const result = readRecord(key, parse, fallback);
    found = result.found;
    cache = result.found ? result.value : (onFirstVisit?.(result.value) ?? result.value);
    return cache;
  };

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // getSnapshot 必须返回稳定引用，否则 React 会判定为无限更新。
    getSnapshot: load,
    getServerSnapshot: () => fallback,
    set: (value) => {
      cache = value;
      found = true;
      writeRecord(key, value);
      emit();
    },
    setQuiet: (value) => {
      cache = value;
      found = true;
      return writeRecord(key, value);
    },
    reset: () => {
      removeRecord(key);
      cache = fallback;
      found = false;
      emit();
    },
    isFound: () => found,
  };
}

/** 只在客户端为 true，且不需要 effect —— 用来跳过依赖 DOM 的渲染。 */
export const clientOnlyStore = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
