import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 这个颜色算不算深色底。
 *
 * 只服务于「图表该用浅色还是深色配色」这类判断，所以用感知亮度就够，不必上 WCAG
 * 那套相对亮度。认不出的颜色（渐变、颜色函数、空值）一律当浅色，和默认主题一致。
 */
export function isDarkColor(color: string): boolean {
  const value = color.trim().replace(/^#/, "");
  const hex =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const rgb = Number.parseInt(hex, 16);
  const [r, g, b] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
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
