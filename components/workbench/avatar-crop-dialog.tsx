"use client";

import { Crop, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { toast } from "sonner";

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

const AVATAR_EXPORT_SIZE = 512;

function cropCanvasToAvatarDataUrl(canvas: HTMLCanvasElement): string {
  const side = Math.min(AVATAR_EXPORT_SIZE, Math.max(1, Math.min(canvas.width, canvas.height)));
  const output = document.createElement("canvas");
  output.width = side;
  output.height = side;

  const context = output.getContext("2d");
  if (!context) throw new Error("canvas");

  context.drawImage(canvas, 0, 0, side, side);
  return output.toDataURL("image/webp", 0.9);
}

interface AvatarCropDialogProps {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (avatar: string) => void;
  labels: {
    title: string;
    description: string;
    zoomOut: string;
    zoomIn: string;
    reset: string;
    cancel: string;
    save: string;
    saveError: string;
  };
}

/** A local-only, locked 1:1 crop step used before an avatar reaches profile storage. */
export function AvatarCropDialog({
  src,
  open,
  onOpenChange,
  onSave,
  labels,
}: AvatarCropDialogProps) {
  const cropperRef = React.useRef<CropperRef>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = () => {
    const canvas = cropperRef.current?.getCanvas();
    if (!canvas) {
      toast.error(labels.saveError);
      return;
    }

    try {
      setSaving(true);
      onSave(cropCanvasToAvatarDataUrl(canvas));
      onOpenChange(false);
    } catch {
      toast.error(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0" closeLabel={labels.cancel}>
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="size-4 text-muted-foreground" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 p-4">
          <div className="mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border bg-black shadow-sm">
            <React.Suspense fallback={<div className="size-full" />}>
              <Cropper
                ref={cropperRef}
                src={src}
                className="size-full"
                stencilProps={{ aspectRatio: 1, grid: true }}
              />
            </React.Suspense>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 border-t px-5 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.zoomOut}
            title={labels.zoomOut}
            onClick={() => cropperRef.current?.zoomImage(0.8)}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.reset}
            title={labels.reset}
            onClick={() => cropperRef.current?.reset()}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.zoomIn}
            title={labels.zoomIn}
            onClick={() => cropperRef.current?.zoomImage(1.2)}
          >
            <ZoomIn />
          </Button>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
