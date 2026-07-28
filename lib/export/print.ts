/**
 * 打印 / 存为 PDF。
 *
 * 不直接打印工作台里的预览：那棵 DOM 挂在一串 flex + `overflow: hidden` 的容器里，
 * 浏览器打印时只会出第一屏。这里把内联好样式的副本挂到 `<body>` 下的独立容器，
 * 打印样式（app/globals.css）再把 body 的其它子节点藏掉，分页就交回浏览器自己算。
 */

export const PRINT_AREA_ID = "ft-print-area";

/**
 * @param node 已经内联好样式的节点（lib/render/portable.ts 的产物）
 * @param title 打印页眉与「另存为 PDF」的默认文件名
 */
export function printNode(node: HTMLElement, title: string): void {
  if (typeof window === "undefined") return;

  document.getElementById(PRINT_AREA_ID)?.remove();
  const area = document.createElement("div");
  area.id = PRINT_AREA_ID;
  area.appendChild(node);
  document.body.appendChild(area);

  const originalTitle = document.title;
  if (title) document.title = title;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.title = originalTitle;
    area.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  try {
    window.print();
  } finally {
    // Chrome 的 afterprint 在打印对话框关掉后才来；Safari 有时干脆不触发，
    // 所以再挂一个兜底，避免临时容器一直留在 DOM 里。
    window.setTimeout(cleanup, 60_000);
  }
}
