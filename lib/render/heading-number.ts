import type { HeadingNumberPosition, HeadingNumberStyle } from "@/lib/themes/types";

/**
 * 标题自动编号的 DOM 装饰逻辑，公众号和小红书共用：
 * 都是往标题节点前/后插入一个带内联样式的 `<span>`，不依赖任何外部 CSS。
 */

function css(declarations: Record<string, string | number | undefined>): string {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function styleFontSize(multiplier: number): number {
  return Math.max(10, 16 * multiplier);
}

function numberGroup(
  doc: Document,
  sequence: string,
  config: HeadingNumberStyle,
  accentColor: string,
): HTMLElement {
  const group = doc.createElement("span");
  const vertical = config.labelPosition === "top" || config.labelPosition === "bottom";
  const reverse = config.labelPosition === "left" || config.labelPosition === "top";
  group.setAttribute("aria-hidden", "true");
  group.setAttribute("style", css({
    display: "inline-flex",
    "flex-direction": vertical ? (reverse ? "column-reverse" : "column") : (reverse ? "row-reverse" : "row"),
    "align-items": "center",
    "justify-content": "center",
    gap: vertical ? "2px" : "6px",
    "margin-right": config.position === "left" ? "12px" : undefined,
    "line-height": 1,
    "white-space": "nowrap",
  }));
  const number = doc.createElement("span");
  number.textContent = sequence;
  number.setAttribute("style", css({
    "font-size": `${Math.round(styleFontSize(config.sizeMultiplier))}px`,
    "font-weight": 900,
    color: config.color || accentColor,
    opacity: config.opacity,
    "line-height": 1,
  }));
  group.appendChild(number);
  if (config.labelText.trim()) {
    const label = doc.createElement("span");
    label.textContent = config.labelText.trim();
    label.setAttribute("style", css({
      "font-size": `${Math.round(styleFontSize(config.labelSizeMultiplier))}px`,
      "font-weight": 700,
      color: config.labelColor || config.color || accentColor,
      opacity: config.labelOpacity,
      "letter-spacing": "1px",
      "line-height": 1,
    }));
    group.appendChild(label);
  }
  return group;
}

function placeHeadingNumber(
  heading: HTMLElement,
  group: HTMLElement,
  position: HeadingNumberPosition,
): void {
  if (position === "behind") {
    heading.setAttribute("style", `${heading.getAttribute("style") ?? ""}; position: relative; isolation: isolate`);
    group.setAttribute("style", `${group.getAttribute("style") ?? ""}; position: absolute; left: 0; top: 50%; transform: translateY(-50%); z-index: -1`);
    heading.insertBefore(group, heading.firstChild);
    return;
  }
  if (position === "top") {
    group.setAttribute("style", `${group.getAttribute("style") ?? ""}; display: flex; width: fit-content; margin: 0 0 6px`);
    heading.insertBefore(group, heading.firstChild);
    return;
  }
  if (position === "bottom") {
    group.setAttribute("style", `${group.getAttribute("style") ?? ""}; display: flex; width: fit-content; margin: 6px 0 0`);
    heading.appendChild(group);
    return;
  }
  heading.insertBefore(group, heading.firstChild);
}

export interface HeadingNumberLevels {
  h1: { number: HeadingNumberStyle };
  h2: { number: HeadingNumberStyle };
  h3: { number: HeadingNumberStyle };
}

/**
 * H1/H2/H3 各自独立开关和配置序号，级别之间的序号各自单独计数。
 * `baseFontSize` 用于把编号大小换算到与正文字号匹配的比例（基准 16px）。
 */
export function appendHeadingNumbers(
  holder: HTMLElement,
  headings: HeadingNumberLevels,
  baseFontSize: number,
  accentColor: string,
): void {
  (["h1", "h2", "h3"] as const).forEach((tag) => {
    const config = headings[tag].number;
    if (!config.enabled) return;
    holder.querySelectorAll(tag).forEach((heading, index) => {
      const group = numberGroup(holder.ownerDocument, String(index + 1).padStart(2, "0"), {
        ...config,
        sizeMultiplier: config.sizeMultiplier * (baseFontSize / 16),
        labelSizeMultiplier: config.labelSizeMultiplier * (baseFontSize / 16),
      }, accentColor);
      placeHeadingNumber(heading as HTMLElement, group, config.position);
    });
  });
}
