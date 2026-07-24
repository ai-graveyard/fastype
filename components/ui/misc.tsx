"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check } from "lucide-react";
import * as React from "react";

import { ColorPicker } from "@/components/common/color-picker";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-brand-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-4 rounded-full border border-primary/50 bg-background shadow transition-colors disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "data-[state=checked]:bg-brand-primary data-[state=unchecked]:bg-input disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-md border border-border/80 bg-muted/55 p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent px-3 py-1 text-sm font-medium transition-all",
      "data-[state=active]:bg-card data-[state=active]:text-brand-primary data-[state=active]:shadow-sm",
      "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

/** 带标签的表单行，设置面板里反复用到。 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** 在 [min, max] 范围内按 step 取整，均匀挑出最多 4 个快捷数值，作为滑杆默认的快捷选项。 */
function defaultSliderPresets(min: number, max: number, step: number): number[] {
  if (!(max > min) || !(step > 0)) return [];
  const decimals = (() => {
    const text = step.toString();
    const dotIndex = text.indexOf(".");
    return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
  })();
  const stepCount = Math.max(1, Math.round((max - min) / step));
  const pick = (fraction: number) => {
    const index = Math.round(stepCount * fraction);
    const raw = min + index * step;
    return Number(raw.toFixed(decimals));
  };
  const presets = [0, 1 / 3, 2 / 3, 1].map(pick);
  return Array.from(new Set(presets));
}

/** 平铺展示的多选一按钮网格，替代下拉框。 */
export function ChoiceGrid<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 4,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; sample?: React.ReactNode }>;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative min-h-10 rounded-lg border px-2 py-2 text-xs transition-colors",
              value === option.value
                ? "border-brand-primary bg-brand-primary/8 text-brand-primary ring-1 ring-brand-primary/20"
                : "border-border hover:bg-accent",
            )}
          >
            {option.sample ? <span className="mb-1 block text-base text-foreground">{option.sample}</span> : null}
            {option.label}
            {value === option.value ? <Check className="absolute right-1.5 top-1.5 size-3" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 数值滑块 + 当前值：滑杆与 4 个快捷选项各占一半宽度、左右并排；当所在列没有另一半空间时（例如滑杆被挤在网格的最右一栏），快捷选项会整体换到滑杆下方，改为占满该列宽度。判断依据是滑杆自身的可用宽度（容器查询），与它在页面里具体处于哪一栏无关。传入 `forceRow` 时不再响应容器宽度，始终强制滑杆与快捷选项左右并排为一行。 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  presets,
  presetFormat,
  onChange,
  forceRow = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** 快捷选项数值，最多取前 4 个；不传时按 min/max/step 自动生成。 */
  presets?: readonly number[];
  /** 快捷选项的文案，默认与顶部当前值一致（数值 + suffix）。 */
  presetFormat?: (option: number) => string;
  onChange: (value: number) => void;
  /** 强制滑杆区域与快捷选项始终左右并排（不随容器变窄而换行堆叠），用于需要多个滑杆逐行紧凑排列的场景。 */
  forceRow?: boolean;
}) {
  const id = React.useId();
  const format = presetFormat ?? ((option: number) => `${option}${suffix}`);
  const options = (presets ?? defaultSliderPresets(min, max, step)).slice(0, 4);
  const sliderGroup = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  );
  if (options.length === 0) return sliderGroup;
  const presetsGrid = (
    <div className="grid grid-cols-4 gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "cursor-pointer rounded-md border px-1.5 py-2 text-center text-xs font-medium transition-colors",
            value === option
              ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
          )}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
  if (forceRow) {
    return (
      <div className="grid grid-cols-2 items-center gap-x-4">
        {sliderGroup}
        {presetsGrid}
      </div>
    );
  }
  return (
    <div className="@container">
      <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 @sm:grid-cols-2">
        {sliderGroup}
        {presetsGrid}
      </div>
    </div>
  );
}

/** 颜色选择：色块 + 文本输入，不只依赖颜色表达（PRD FT-SET-003）。 */
export function ColorField({
  label,
  value,
  onChange,
  themeColor,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** 与当前主题一致的配色；提供时展示"恢复"按钮。 */
  themeColor?: string;
}) {
  return (
    <ColorPicker label={label} value={value} onChange={onChange} themeColor={themeColor} />
  );
}
