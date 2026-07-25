import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarCropDialog } from "@/components/workbench/avatar-crop-dialog";

const cropperApi = {
  getCanvas: vi.fn(),
  reset: vi.fn(),
  zoomImage: vi.fn(),
};

vi.mock("react-advanced-cropper", () => ({
  Cropper: React.forwardRef(function MockCropper(
    props: { stencilProps: { aspectRatio: number } },
    ref: React.ForwardedRef<typeof cropperApi>,
  ) {
    React.useImperativeHandle(ref, () => cropperApi);
    return <div data-testid="avatar-cropper" data-aspect={props.stencilProps.aspectRatio} />;
  }),
}));

const labels = {
  title: "Crop avatar",
  description: "Move the image inside the square.",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  reset: "Reset crop",
  cancel: "Cancel",
  save: "Apply crop",
  saveError: "Crop failed",
};

afterEach(() => vi.restoreAllMocks());

describe("AvatarCropDialog", () => {
  it("keeps the crop selection square and only applies the avatar after confirmation", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 800;
    sourceCanvas.height = 800;
    cropperApi.getCanvas.mockReturnValue(sourceCanvas);

    const context = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/webp;base64,cropped",
    );

    render(
      <AvatarCropDialog
        src="blob:avatar"
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        labels={labels}
      />,
    );

    // 裁剪器是懒加载的，等它挂载后再断言。
    const cropper = await screen.findByTestId("avatar-cropper");
    expect(cropper.getAttribute("data-aspect")).toBe("1");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(onSave).toHaveBeenCalledWith("data:image/webp;base64,cropped");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("provides reset and zoom controls without applying a crop", async () => {
    render(
      <AvatarCropDialog
        src="blob:avatar"
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        labels={labels}
      />,
    );
    await screen.findByTestId("avatar-cropper");

    fireEvent.click(screen.getByRole("button", { name: labels.zoomOut }));
    fireEvent.click(screen.getByRole("button", { name: labels.reset }));
    fireEvent.click(screen.getByRole("button", { name: labels.zoomIn }));

    expect(cropperApi.zoomImage).toHaveBeenNthCalledWith(1, 0.8);
    expect(cropperApi.reset).toHaveBeenCalledOnce();
    expect(cropperApi.zoomImage).toHaveBeenNthCalledWith(2, 1.2);
  });
});
