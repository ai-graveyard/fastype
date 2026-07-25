"use client";

import { Check, Crop, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { toast } from "sonner";

import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { WECHAT_COVER_FORMATS, type WechatCoverFormat } from "@/lib/wechat-cover";
import { cn } from "@/lib/utils";

function cropCanvasToDataUrl(canvas: HTMLCanvasElement, format: WechatCoverFormat): string {
  const size = WECHAT_COVER_FORMATS[format];
  const output = document.createElement("canvas");
  output.width = size.width;
  output.height = size.height;

  const context = output.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(canvas, 0, 0, size.width, size.height);
  return output.toDataURL("image/webp", 0.9);
}

// 裁剪器只在用户真的打开裁剪弹窗时才需要，别让它压在首屏包里。
const Cropper = React.lazy(async () => ({
  default: (await import("react-advanced-cropper")).Cropper,
}));

interface WechatCoverCropDialogProps {
  src: string;
  open: boolean;
  initialFormat?: WechatCoverFormat;
  savedFormats: Record<WechatCoverFormat, boolean>;
  onOpenChange: (open: boolean) => void;
  onSave: (format: WechatCoverFormat, image: string) => void;
}

export function WechatCoverCropDialog({
  src,
  open,
  initialFormat = "wide",
  savedFormats,
  onOpenChange,
  onSave,
}: WechatCoverCropDialogProps) {
  const t = useT();
  const cropperRef = React.useRef<CropperRef>(null);
  const [format, setFormat] = React.useState<WechatCoverFormat>(initialFormat);
  const [saving, setSaving] = React.useState(false);

  const size = WECHAT_COVER_FORMATS[format];
  const handleSave = () => {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) {
      toast.error(t("wechat.coverCropSaveError"));
      return;
    }

    try {
      setSaving(true);
      onSave(format, cropCanvasToDataUrl(canvas, format));
      toast.success(t(format === "wide" ? "wechat.coverWideSaved" : "wechat.coverSquareSaved"));
    } catch {
      toast.error(t("wechat.coverCropSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("wechat.coverCropTitle")}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]",
        !open && "hidden",
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="border-b border-dashed px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Crop className="size-4 text-muted-foreground" />
            {t("wechat.coverCropTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("wechat.coverCropDesc")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b bg-muted/20 p-3">
          {(["wide", "square"] as const).map((item) => {
            const itemSize = WECHAT_COVER_FORMATS[item];
            const selected = item === format;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => setFormat(item)}
                className={cn(
                  "relative rounded-lg border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <span className="block text-xs font-medium">
                  {t(item === "wide" ? "wechat.coverWide" : "wechat.coverSquare")}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  {itemSize.width} × {itemSize.height}
                </span>
                {savedFormats[item] ? (
                  <Check className="absolute right-2 top-2 size-3.5 text-emerald-600" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div
            className={cn(
              "mx-auto w-full overflow-hidden rounded-lg border bg-black shadow-sm",
              format === "wide" ? "max-w-[760px]" : "max-w-[460px]",
            )}
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
          >
            <React.Suspense fallback={<div className="size-full" />}>
              <Cropper
                key={`${src}-${format}`}
                ref={cropperRef}
                src={src}
                className="size-full"
                stencilProps={{ aspectRatio: size.width / size.height, grid: true }}
              />
            </React.Suspense>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 border-t px-5 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("profile.zoomOut")}
            onClick={() => cropperRef.current?.zoomImage(0.8)}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("profile.resetCrop")}
            onClick={() => cropperRef.current?.reset()}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("profile.zoomIn")}
            onClick={() => cropperRef.current?.zoomImage(1.2)}
          >
            <ZoomIn />
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-dashed px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {t("wechat.coverSaveCurrent")}
          </Button>
        </div>
      </div>
    </div>
  );
}
