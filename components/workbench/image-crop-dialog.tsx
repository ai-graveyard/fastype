"use client";

import { Crop, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { toast } from "sonner";

import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 裁剪器只在用户真的打开裁剪弹窗时才需要，别让它压在首屏包里。
const Cropper = React.lazy(async () => ({
  default: (await import("react-advanced-cropper")).Cropper,
}));

/** 裁剪结果的最大边长，和插入时的上限一致。 */
const MAX_EDGE = 1600;

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  const longest = Math.max(canvas.width, canvas.height);
  if (longest <= MAX_EDGE) return canvas.toDataURL("image/webp", 0.85);

  const ratio = MAX_EDGE / longest;
  const output = document.createElement("canvas");
  output.width = Math.round(canvas.width * ratio);
  output.height = Math.round(canvas.height * ratio);
  const context = output.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output.toDataURL("image/webp", 0.85);
}

interface ImageCropDialogProps {
  /** 待裁剪的图片地址；跨域的远程图取不到画布，调用方应先挡掉。 */
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
}

/** 正文插图的自由比例裁剪；结果替换原图的地址，其余属性不动。 */
export function ImageCropDialog({ src, open, onOpenChange, onSave }: ImageCropDialogProps) {
  const t = useT();
  const cropperRef = React.useRef<CropperRef>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = () => {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) {
      toast.error(t("image.cropFailed"));
      return;
    }
    try {
      setSaving(true);
      onSave(canvasToDataUrl(canvas));
      onOpenChange(false);
    } catch {
      // 远程图片没开 CORS 时画布是被污染的，导不出来。
      toast.error(t("image.cropFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" closeLabel={t("common.cancel")}>
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="size-4 text-muted-foreground" />
            {t("image.cropTitle")}
          </DialogTitle>
          <DialogDescription>{t("image.cropDescription")}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 p-4">
          <div className="mx-auto aspect-[4/3] w-full overflow-hidden rounded-lg border bg-black shadow-sm">
            <React.Suspense fallback={<div className="size-full" />}>
              <Cropper
                ref={cropperRef}
                src={src}
                className="size-full"
                stencilProps={{ grid: true }}
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
            title={t("profile.zoomOut")}
            onClick={() => cropperRef.current?.zoomImage(0.8)}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("profile.resetCrop")}
            title={t("profile.resetCrop")}
            onClick={() => cropperRef.current?.reset()}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("profile.zoomIn")}
            title={t("profile.zoomIn")}
            onClick={() => cropperRef.current?.zoomImage(1.2)}
          >
            <ZoomIn />
          </Button>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {t("image.cropApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
