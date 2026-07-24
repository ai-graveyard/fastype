"use client";

/**
 * 与 LoveType 保持一致的颜色控件：预设色板、系统取色器与 HEX 输入共用同一数据契约。
 * 所有颜色设置都从这里进入，避免各工作区各自维护一套“快捷颜色”。
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const DEFAULT_PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
] as const;

const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

function normalizeHex(value: string): string {
  const sanitized = value.trim().replace(/^#/, "").slice(0, 6);
  return HEX_COLOR_PATTERN.test(sanitized) ? `#${sanitized.toLowerCase()}` : "#3b82f6";
}

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** 与当前主题一致的配色；提供时会展示"恢复"按钮，一键改回该颜色。 */
  themeColor?: string;
  presetColors?: readonly string[];
  displayValue?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  restoreLabel?: string;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  themeColor,
  presetColors = DEFAULT_PRESET_COLORS,
  displayValue,
  label,
  placeholder,
  confirmLabel = "确认",
  restoreLabel = "恢复",
  className,
}: ColorPickerProps) {
  const normalizedValue = React.useMemo(() => {
    const sanitized = value.trim().replace(/^#/, "").slice(0, 6);
    return HEX_COLOR_PATTERN.test(sanitized) ? `#${sanitized.toLowerCase()}` : "";
  }, [value]);
  const resolvedValue = React.useMemo(
    () => normalizeHex(displayValue || normalizedValue || "#3b82f6"),
    [displayValue, normalizedValue],
  );
  const normalizedThemeColor = React.useMemo(() => {
    if (!themeColor) return null;
    const sanitized = themeColor.trim().replace(/^#/, "").slice(0, 6);
    return HEX_COLOR_PATTERN.test(sanitized) ? `#${sanitized.toLowerCase()}` : null;
  }, [themeColor]);
  const matchesThemeColor = normalizedThemeColor !== null && normalizedValue === normalizedThemeColor;
  const [inputValue, setInputValue] = React.useState(
    normalizedValue ? normalizedValue.slice(1).toUpperCase() : "",
  );
  const isValidHex = HEX_COLOR_PATTERN.test(inputValue);
  const pendingHex = isValidHex ? `#${inputValue.toLowerCase()}` : null;
  const hasPendingChange = pendingHex !== null && pendingHex !== normalizedValue;

  React.useEffect(() => {
    // The HEX input is an editable draft of a controlled color; external preset/theme changes
    // must replace that draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(normalizedValue ? normalizedValue.slice(1).toUpperCase() : "");
  }, [normalizedValue]);

  return (
    <div className={cn("space-y-3 rounded-lg border bg-muted/20 p-3", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-6 gap-2">
        {presetColors.map((color) => {
          const isSelected = normalizedValue !== "" && normalizedValue === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color.toLowerCase())}
              className={cn(
                "size-8 cursor-pointer rounded-full border-2 transition-all",
                isSelected
                  ? "scale-105 border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/40",
              )}
              style={{ backgroundColor: color }}
              aria-label={`${label} ${color}`}
              aria-pressed={isSelected}
              title={color}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="relative size-10 shrink-0 overflow-hidden rounded-md"
          style={{ backgroundColor: resolvedValue }}
          title={resolvedValue}
        >
          <input
            type="color"
            value={resolvedValue}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            #
          </span>
          <Input
            value={inputValue}
            onChange={(event) =>
              setInputValue(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase())
            }
            placeholder={placeholder}
            className="pl-7 font-mono uppercase"
            maxLength={6}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={label}
            onKeyDown={(event) => {
              if (event.key === "Enter" && hasPendingChange && pendingHex) {
                event.preventDefault();
                onChange(pendingHex);
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={!hasPendingChange} onClick={() => pendingHex && onChange(pendingHex)}>
          {confirmLabel}
        </Button>
        {normalizedThemeColor ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={matchesThemeColor}
            onClick={() => onChange(normalizedThemeColor)}
            title={normalizedThemeColor}
          >
            {restoreLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
