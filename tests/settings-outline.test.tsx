import { fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsOutline } from "@/components/workbench/settings-outline";

const SECTIONS = [
  { id: "sec-a", label: "章节 A" },
  { id: "sec-b", label: "章节 B" },
  { id: "sec-c", label: "章节 C" },
];

function renderOutline(containerEl: HTMLDivElement) {
  const containerRef = { current: containerEl } as RefObject<HTMLDivElement | null>;
  return render(<SettingsOutline label="目录" containerRef={containerRef} sections={SECTIONS} />);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.animate = vi.fn().mockReturnValue({} as Animation);
});

describe("SettingsOutline", () => {
  it("常驻展开成列表，不是需要二次点击才展开的下拉菜单", () => {
    const container = document.createElement("div");
    SECTIONS.forEach((section) => {
      const el = document.createElement("section");
      el.id = section.id;
      container.appendChild(el);
    });
    renderOutline(container);

    // 三个子项一次性都在文档中可见，不藏在需要先点开的触发按钮后面。
    expect(screen.getByRole("navigation", { name: "目录" })).toBeTruthy();
    SECTIONS.forEach((section) => {
      expect(screen.getByRole("button", { name: section.label })).toBeTruthy();
    });
  });

  it("点击子项直接跳转到对应卡片，不需要先展开", () => {
    const container = document.createElement("div");
    const targetEl = document.createElement("section");
    targetEl.id = "sec-b";
    container.appendChild(targetEl);
    renderOutline(container);

    fireEvent.click(screen.getByRole("button", { name: "章节 B" }));
    expect(targetEl.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("卡片数不够 minSections 时不渲染，避免给简单 Tab 添加多余侧栏", () => {
    const container = document.createElement("div");
    const containerRef = { current: container } as RefObject<HTMLDivElement | null>;
    render(
      <SettingsOutline label="目录" containerRef={containerRef} sections={SECTIONS.slice(0, 2)} />,
    );
    expect(screen.queryByRole("navigation", { name: "目录" })).toBeNull();
  });
});
