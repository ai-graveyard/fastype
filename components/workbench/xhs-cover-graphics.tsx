"use client";

import {
  Asterisk,
  ArrowUpRight,
  Circle,
  Cloud,
  Flower2,
  Heart,
  Quote,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Triangle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { ColorField, SliderField } from "@/components/ui/misc";
import type { TKey } from "@/lib/i18n";
import {
  XHS_COVER_GRAPHIC_ICONS,
  XHS_COVER_GRAPHICS_LIMIT,
  type XhsCoverGraphic,
  type XhsCoverGraphicIcon,
} from "@/lib/themes/xhs";
import { cn } from "@/lib/utils";

const COVER_GRAPHIC_ICONS: Record<XhsCoverGraphicIcon, LucideIcon> = {
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  flower: Flower2,
  sun: Sun,
  zap: Zap,
  cloud: Cloud,
  quote: Quote,
  "arrow-up-right": ArrowUpRight,
  asterisk: Asterisk,
  circle: Circle,
  triangle: Triangle,
};

const COVER_GRAPHIC_LABEL_KEYS: Record<XhsCoverGraphicIcon, TKey> = {
  sparkles: "xhs.coverGraphicSparkles",
  star: "xhs.coverGraphicStar",
  heart: "xhs.coverGraphicHeart",
  flower: "xhs.coverGraphicFlower",
  sun: "xhs.coverGraphicSun",
  zap: "xhs.coverGraphicZap",
  cloud: "xhs.coverGraphicCloud",
  quote: "xhs.coverGraphicQuote",
  "arrow-up-right": "xhs.coverGraphicArrow",
  asterisk: "xhs.coverGraphicAsterisk",
  circle: "xhs.coverGraphicCircle",
  triangle: "xhs.coverGraphicTriangle",
};

const NEW_GRAPHIC_POSITIONS = [
  { x: 82, y: 18 },
  { x: 18, y: 20 },
  { x: 82, y: 80 },
  { x: 18, y: 82 },
  { x: 50, y: 15 },
  { x: 50, y: 85 },
] as const;

function createGraphicId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cover-graphic-${crypto.randomUUID()}`;
  }
  return `cover-graphic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function CoverGraphicsLayer({
  graphics,
  canvasWidth,
  mode = "export",
  selectedId,
  onSelect,
  onMove,
  className,
}: {
  graphics: XhsCoverGraphic[];
  canvasWidth: number;
  mode?: "export" | "preview";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, patch: Pick<XhsCoverGraphic, "x" | "y">) => void;
  className?: string;
}) {
  const t = useT();
  const interactive = mode === "preview";

  if (graphics.length === 0) return null;

  return (
    <div
      className={cn(
        "ft-xhs-cover-graphics absolute inset-0",
        interactive ? "z-10" : "pointer-events-none z-0",
        className,
      )}
      aria-hidden={interactive ? undefined : true}
    >
      {graphics.map((graphic) => {
        const Icon = COVER_GRAPHIC_ICONS[graphic.icon];
        const label = t(COVER_GRAPHIC_LABEL_KEYS[graphic.icon]);
        const selected = interactive && selectedId === graphic.id;
        const moveFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
          if (!interactive || !onMove || !event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }
          const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
          if (!bounds?.width || !bounds.height) return;
          onMove(graphic.id, {
            x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
            y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100),
          });
        };

        return (
          <div
            key={graphic.id}
            data-cover-graphic={graphic.icon}
            data-cover-graphic-id={graphic.id}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? t("xhs.coverGraphicSelect", { name: label }) : undefined}
            aria-pressed={interactive ? selected : undefined}
            className={cn(
              "absolute flex aspect-square items-center justify-center rounded-md",
              interactive &&
                "touch-none cursor-grab outline-offset-[6px] focus-visible:outline-2 focus-visible:outline-brand-primary active:cursor-grabbing",
              selected && "outline-2 outline-brand-primary",
            )}
            style={{
              left: `${graphic.x}%`,
              top: `${graphic.y}%`,
              width: mode === "preview" ? `${(graphic.size / canvasWidth) * 100}%` : graphic.size,
              color: graphic.color,
              opacity: graphic.opacity,
              transform: `translate(-50%, -50%) rotate(${graphic.rotation}deg)`,
              transformOrigin: "center",
              pointerEvents: interactive ? "auto" : "none",
            }}
            onClick={interactive ? () => onSelect?.(graphic.id) : undefined}
            onPointerDown={
              interactive
                ? (event) => {
                    event.preventDefault();
                    onSelect?.(graphic.id);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }
                : undefined
            }
            onPointerMove={interactive ? moveFromPointer : undefined}
            onPointerUp={
              interactive
                ? (event) => {
                    moveFromPointer(event);
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                : undefined
            }
            onKeyDown={
              interactive
                ? (event) => {
                    const delta = event.shiftKey ? 5 : 1;
                    const patch =
                      event.key === "ArrowLeft"
                        ? { x: clampPercent(graphic.x - delta), y: graphic.y }
                        : event.key === "ArrowRight"
                          ? { x: clampPercent(graphic.x + delta), y: graphic.y }
                          : event.key === "ArrowUp"
                            ? { x: graphic.x, y: clampPercent(graphic.y - delta) }
                            : event.key === "ArrowDown"
                              ? { x: graphic.x, y: clampPercent(graphic.y + delta) }
                              : null;
                    if (!patch) return;
                    event.preventDefault();
                    onSelect?.(graphic.id);
                    onMove?.(graphic.id, patch);
                  }
                : undefined
            }
          >
            <Icon
              aria-hidden="true"
              className="size-full"
              color={graphic.color}
              strokeWidth={graphic.strokeWidth}
            />
          </div>
        );
      })}
    </div>
  );
}

type CoverGraphicsControlsProps = {
  graphics: XhsCoverGraphic[];
  defaultColor: string;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  onChange: (graphics: XhsCoverGraphic[]) => void;
};

export function CoverGraphicsControls({
  graphics,
  defaultColor,
  onSelectedIdChange,
  onChange,
}: CoverGraphicsControlsProps) {
  const t = useT();
  const canAdd = graphics.length < XHS_COVER_GRAPHICS_LIMIT;

  const addGraphic = (icon: XhsCoverGraphicIcon) => {
    if (!canAdd) return;
    const position = NEW_GRAPHIC_POSITIONS[graphics.length % NEW_GRAPHIC_POSITIONS.length];
    const graphic: XhsCoverGraphic = {
      id: createGraphicId(),
      icon,
      x: position.x,
      y: position.y,
      size: 160,
      rotation: 0,
      color: defaultColor,
      opacity: 0.85,
      strokeWidth: 2,
    };
    onChange([...graphics, graphic]);
    onSelectedIdChange(graphic.id);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium">{t("xhs.coverGraphics")}</h4>
          <span className="text-xs tabular-nums text-muted-foreground">
            {graphics.length}/{XHS_COVER_GRAPHICS_LIMIT}
          </span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t("xhs.coverGraphicsDesc")}</p>
      </div>

      <div
        className="grid grid-cols-6 gap-2"
        role="group"
        aria-label={t("xhs.coverGraphicLibrary")}
      >
        {XHS_COVER_GRAPHIC_ICONS.map((icon) => {
          const Icon = COVER_GRAPHIC_ICONS[icon];
          const label = t(COVER_GRAPHIC_LABEL_KEYS[icon]);
          return (
            <button
              key={icon}
              type="button"
              disabled={!canAdd}
              onClick={() => addGraphic(icon)}
              className="flex aspect-square items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-brand-primary/45 hover:bg-brand-primary/5 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("xhs.coverGraphicAdd", { name: label })}
              title={t("xhs.coverGraphicAdd", { name: label })}
            >
              <Icon className="size-[46%]" strokeWidth={1.8} />
            </button>
          );
        })}
      </div>

      {graphics.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          {t("xhs.coverGraphicsEmpty")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("xhs.coverGraphicsDragHint")}</p>
      )}
    </div>
  );
}

export function CoverGraphicsEditor({
  graphics,
  defaultColor,
  selectedId,
  onSelectedIdChange,
  onChange,
}: CoverGraphicsControlsProps) {
  const t = useT();
  const selected = graphics.find((graphic) => graphic.id === selectedId) ?? null;

  const updateSelected = (patch: Partial<XhsCoverGraphic>) => {
    if (!selected) return;
    onChange(
      graphics.map((graphic) => (graphic.id === selected.id ? { ...graphic, ...patch } : graphic)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    const index = graphics.findIndex((graphic) => graphic.id === selected.id);
    const next = graphics.filter((graphic) => graphic.id !== selected.id);
    onChange(next);
    onSelectedIdChange(next[Math.min(index, next.length - 1)]?.id ?? null);
  };

  if (!selected) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {t("xhs.coverGraphicEditing", {
            name: t(COVER_GRAPHIC_LABEL_KEYS[selected.icon]),
          })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={removeSelected}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("xhs.coverGraphicRemove")}
          title={t("xhs.coverGraphicRemove")}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorField
          label={t("xhs.coverGraphicColor")}
          value={selected.color}
          themeColor={defaultColor}
          onChange={(color) => updateSelected({ color })}
        />
        <div className="space-y-4">
          <SliderField
            label={t("xhs.coverGraphicSize")}
            value={selected.size}
            min={48}
            max={360}
            step={4}
            suffix="px"
            onChange={(size) => updateSelected({ size })}
          />
          <SliderField
            label={t("xhs.coverGraphicRotation")}
            value={selected.rotation}
            min={-180}
            max={180}
            step={5}
            suffix="°"
            onChange={(rotation) => updateSelected({ rotation })}
          />
        </div>
        <SliderField
          label={t("xhs.coverGraphicOpacity")}
          value={selected.opacity}
          min={0.1}
          max={1}
          step={0.05}
          onChange={(opacity) => updateSelected({ opacity })}
        />
        <SliderField
          label={t("xhs.coverGraphicStroke")}
          value={selected.strokeWidth}
          min={1}
          max={5}
          step={0.25}
          onChange={(strokeWidth) => updateSelected({ strokeWidth })}
        />
      </div>
    </div>
  );
}
