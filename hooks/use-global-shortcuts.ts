"use client";

import * as React from "react";

export interface GlobalShortcutHandlers {
  /** Cmd/Ctrl+S */
  onSave: () => void;
  /** Cmd/Ctrl+O */
  onOpen: () => void;
}

/**
 * 全局快捷键。
 *
 * 只接管浏览器默认行为明显不对的那两个：不拦 Cmd/Ctrl+S 的话，写作时下意识按一下
 * 会弹出「保存网页」；Cmd/Ctrl+O 会打开浏览器自己的文件对话框，拿不到可写回的 handle。
 *
 * 刻意不绑 Cmd/Ctrl+N：这个组合被浏览器保留给「新建窗口」，网页拦不住，
 * 绑了只会得到一个时灵时不灵的快捷键。新建文档仍然只走顶栏按钮。
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 输入法组合期间的按键不算命令。
      if (event.isComposing) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;

      const key = event.key.toLowerCase();
      if (key !== "s" && key !== "o") return;

      event.preventDefault();
      if (key === "s") handlersRef.current.onSave();
      else handlersRef.current.onOpen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * 快捷键提示里用的修饰键写法。
 *
 * 静态导出时服务端拿不到平台信息，一律给 `Ctrl`，客户端接管后再换成 `⌘`。
 * 走 useSyncExternalStore 而不是「effect 里 setState」，和 lib/storage/store.ts 里
 * 的 clientOnlyStore 保持同一套写法。
 */
const modifierKeyStore = {
  subscribe: () => () => {},
  getSnapshot: () => (/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl"),
  getServerSnapshot: () => "Ctrl",
};

export function useModifierKeyLabel(): string {
  return React.useSyncExternalStore(
    modifierKeyStore.subscribe,
    modifierKeyStore.getSnapshot,
    modifierKeyStore.getServerSnapshot,
  );
}
