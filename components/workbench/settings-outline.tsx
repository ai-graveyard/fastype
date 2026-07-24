"use client";

import { ListTree } from "lucide-react";
import * as React from "react";

import { scrollToSection } from "@/lib/utils";

export interface SettingsOutlineSection {
  id: string;
  label: string;
}

interface SettingsOutlineProps {
  sections: SettingsOutlineSection[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  /** 卡片数达不到这个数量时不显示索引，避免给简单 Tab 添加多余的常驻侧栏。 */
  minSections?: number;
}

/**
 * 设置面板里的锚点索引：卡片一多，用户滚一屏未必能看全。
 * 常驻在设置区左侧、子项直接展开，点一下就跳到对应卡片；
 * 跳转和高亮复用预览区点击定位设置卡片的同一套逻辑。
 * 是否渲染由父组件根据可用宽度决定（空间不够时隐藏）。
 */
export function SettingsOutline({
  sections,
  containerRef,
  label,
  minSections = 3,
}: SettingsOutlineProps) {
  if (sections.length < minSections) return null;

  return (
    <nav
      aria-label={label}
      className="w-40 shrink-0 space-y-2 overflow-y-auto border-r border-dashed border-border bg-background/25 p-3"
    >
      <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <ListTree className="size-3.5" />
        <span>{label}</span>
      </p>
      <ul className="space-y-0.5">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => scrollToSection(containerRef.current, section.id)}
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
