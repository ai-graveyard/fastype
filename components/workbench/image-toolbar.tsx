"use client";

import { AlignCenter, AlignLeft, AlignRight, Crop, Trash2 } from "lucide-react";
import * as React from "react";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { TKey } from "@/lib/i18n";
import { dataUrlByteLength, formatBytes, isImageDataUrl } from "@/lib/image/data-url";
import {
  IMAGE_WIDTH_PRESETS,
  type ImageAlign,
  type ImageMarkupMatch,
} from "@/lib/markdown/image-markup";
import { cn } from "@/lib/utils";

const ALIGN_OPTIONS: Array<{
  value: ImageAlign;
  icon: React.ComponentType<{ className?: string }>;
  label: TKey;
}> = [
  { value: "left", icon: AlignLeft, label: "image.alignLeft" },
  { value: "center", icon: AlignCenter, label: "image.alignCenter" },
  { value: "right", icon: AlignRight, label: "image.alignRight" },
];

interface ImageToolbarProps {
  editorRef: React.RefObject<EditorApi | null>;
  onCrop: (image: ImageMarkupMatch) => void;
}

/**
 * 图片工具条。
 *
 * 光标落在某张图的那段源码里就浮出来，改宽度、改对齐、裁剪或删掉这张图。做成跟随光标
 * 而不是「点预览里的图」：编辑器这边是 Markdown 源码，图片本身并不在这里显示。
 */
export function ImageToolbar({ editorRef, onCrop }: ImageToolbarProps) {
  const t = useT();
  const [image, setImage] = React.useState<ImageMarkupMatch | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const attach = () => {
      if (cancelled) return;
      const api = editorRef.current;
      // 这条工具条排在编辑器上方，effect 也就比编辑器的 ref 赋值早一步，下一帧再试。
      if (!api) {
        requestAnimationFrame(attach);
        return;
      }
      const sync = () => setImage(api.getImageAtCursor());
      sync();
      unsubscribe = api.subscribeSelection(sync);
    };
    attach();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [editorRef]);

  if (!image) return null;

  const update = (patch: Partial<Pick<ImageMarkupMatch, "width" | "align">>) => {
    const api = editorRef.current;
    if (!api) return;
    // 每次都按当下的位置重新取一遍，避免拿着一份过期的坐标去改文档。
    const current = api.getImageAtCursor();
    if (!current) return;
    api.replaceImage(current, { ...current, ...patch });
  };

  const remove = () => {
    const api = editorRef.current;
    if (!api) return;
    const current = api.getImageAtCursor();
    if (!current) return;
    api.replaceRange(current.from, current.to, "", "");
  };

  const embedded = isImageDataUrl(image.src);

  return (
    <div
      role="toolbar"
      aria-label={t("image.toolbar")}
      className="flex h-9 shrink-0 items-center gap-1 border-b border-dashed border-border bg-muted/30 px-3"
      // 别让点击夺走编辑器焦点，否则光标一走工具条自己就收起来了。
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="mr-1 shrink-0 text-[11px] font-medium text-muted-foreground">
        {embedded
          ? t("image.embeddedSize", { size: formatBytes(dataUrlByteLength(image.src)) })
          : t("image.remote")}
      </span>

      <div className="flex items-center rounded-md border border-border bg-card p-0.5">
        {IMAGE_WIDTH_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={image.width === preset}
            onClick={() => update({ width: preset })}
            className={cn(
              "h-6 rounded-sm px-2 text-[11px] font-medium tabular-nums transition-colors",
              image.width === preset
                ? "bg-brand-primary/10 text-brand-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {preset}%
          </button>
        ))}
      </div>

      <div className="flex items-center rounded-md border border-border bg-card p-0.5">
        {ALIGN_OPTIONS.map((option) => (
          <Tooltip key={option.value} label={t(option.label)}>
            <button
              type="button"
              aria-pressed={image.align === option.value}
              aria-label={t(option.label)}
              onClick={() => update({ align: option.value })}
              className={cn(
                "flex size-6 items-center justify-center rounded-sm transition-colors",
                image.align === option.value
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="size-3.5" />
            </button>
          </Tooltip>
        ))}
      </div>

      <Tooltip label={t("image.crop")}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-sm"
          aria-label={t("image.crop")}
          onClick={() => onCrop(image)}
        >
          <Crop />
        </Button>
      </Tooltip>

      <Tooltip label={t("image.remove")}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-sm text-muted-foreground hover:text-destructive"
          aria-label={t("image.remove")}
          onClick={remove}
        >
          <Trash2 />
        </Button>
      </Tooltip>
    </div>
  );
}
