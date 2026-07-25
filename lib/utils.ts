import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 在容器内滚动到指定 id 的元素并短暂高亮描边，用于设置面板里的锚点跳转
 * （预览区点击定位、排版 Tab 内的目录索引都复用这一套反馈）。
 */
export function scrollToSection(container: HTMLElement | null | undefined, id: string) {
  const target = container?.querySelector<HTMLElement>(`#${id}`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.animate(
    [{ boxShadow: "0 0 0 2px rgb(0 136 255 / 0.35)" }, { boxShadow: "0 0 0 0 rgb(0 136 255 / 0)" }],
    { duration: 900, easing: "ease-out" },
  );
}
