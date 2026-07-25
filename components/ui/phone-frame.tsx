"use client";

import { Wifi } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";

export const PHONE_WIDTH = 430;
export const PHONE_HEIGHT = 860;

const HORIZONTAL_PADDING = 160;
const CONTROLS_SAFE_AREA = 48;

interface PhoneStatusBarProps {
  className?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

/** 手机预览共用的 iPhone 风格状态栏。 */
export function PhoneStatusBar({
  className,
  backgroundColor,
  foregroundColor,
}: PhoneStatusBarProps) {
  return (
    <div
      className={cn(
        "flex h-7 shrink-0 items-end justify-between px-5 pb-1 text-[11px] font-semibold text-[#222]",
        className,
      )}
      data-testid="phone-status-bar"
      style={{ backgroundColor, color: foregroundColor }}
    >
      <span>14:36</span>
      <div className="flex items-center gap-2">
        <Wifi className="size-3 stroke-[2.5]" />
        <svg
          aria-hidden="true"
          className="h-3 w-[25px] shrink-0"
          data-testid="phone-battery-icon"
          viewBox="0 0 25 12"
        >
          <rect
            x="0.5"
            y="0.5"
            width="21"
            height="11"
            rx="3.5"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path
            d="M23 4v4c.9-.32 1.5-1.08 1.5-2S23.9 4.32 23 4Z"
            fill="currentColor"
            opacity="0.4"
          />
          <rect
            data-testid="phone-battery-level"
            x="2"
            y="2"
            width="14.4"
            height="8"
            rx="2"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}

export function usePhoneFitScale(
  containerRef: RefObject<HTMLDivElement | null>,
  zoom = 1,
  horizontalPadding = HORIZONTAL_PADDING,
): number {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setContainerSize({ width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  if (!containerSize.width || !containerSize.height) return 0.72 * zoom;

  const availableWidth = Math.max(containerSize.width - horizontalPadding, 1);
  const availableHeight = Math.max(containerSize.height - CONTROLS_SAFE_AREA, 1);
  const fitScale = Math.min(availableWidth / PHONE_WIDTH, availableHeight / PHONE_HEIGHT, 1);
  return fitScale * zoom;
}

interface PhoneFrameProps {
  scale: number;
  screenClassName?: string;
  children: ReactNode;
}

export function PhoneFrame({ scale, screenClassName, children }: PhoneFrameProps) {
  return (
    <div className="relative" style={{ width: PHONE_WIDTH * scale, height: PHONE_HEIGHT * scale }}>
      <div
        className="relative flex shrink-0 flex-col rounded-[2.4rem] bg-[#d4d4d4] p-3 shadow-2xl shadow-black/10 ring-1 ring-black/5"
        style={{
          width: PHONE_WIDTH,
          height: PHONE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div className="pointer-events-none absolute left-1/2 top-5 z-20 h-5 w-[76px] -translate-x-1/2 rounded-full bg-black/80 shadow-sm" />
        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden rounded-[1.85rem] bg-white",
            screenClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
