"use client";

import { Eye, FileCode2 } from "lucide-react";

import { usePrefs } from "@/components/providers/prefs-provider";
import type { PlatformEditorMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 平台“内容”编辑器的紧凑显示切换，固定在编辑器工具栏最右侧。 */
export function PlatformModeSwitcher({
  value,
  onChange,
}: {
  value: PlatformEditorMode;
  onChange: (mode: PlatformEditorMode) => void;
}) {
  const { t } = usePrefs();
  const options = [
    { value: "text" as const, label: t("view.text"), icon: FileCode2 },
    { value: "preview" as const, label: t("view.preview"), icon: Eye },
  ];

  return (
    <div
      className="flex h-8 shrink-0 items-center rounded-md border border-border bg-muted/45 p-0.5"
      role="group"
      aria-label={t("view.modeSwitcher")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm border border-transparent px-2 text-xs font-medium transition-all duration-200",
            value === option.value
              ? "bg-card text-brand-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <option.icon className="size-3.5" aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
