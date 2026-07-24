import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { WechatCoverCropDialog } from "@/components/workbench/wechat-cover-crop-dialog";

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
    return <div data-testid="wechat-cover-cropper" data-aspect={props.stencilProps.aspectRatio} />;
  }),
}));

afterEach(() => vi.restoreAllMocks());

describe("WechatCoverCropDialog", () => {
  it("分别以 900×383 和 500×500 保存同一张原图的裁剪", () => {
    const onSave = vi.fn();
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 900;
    sourceCanvas.height = 383;
    cropperApi.getCanvas.mockReturnValue(sourceCanvas);

    const context = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/webp;base64,cropped",
    );

    render(
      <PrefsProvider>
        <WechatCoverCropDialog
          src="blob:cover"
          open
          savedFormats={{ wide: false, square: false }}
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </PrefsProvider>,
    );

    expect(Number(screen.getByTestId("wechat-cover-cropper").getAttribute("data-aspect"))).toBeCloseTo(
      900 / 383,
    );
    fireEvent.click(screen.getByRole("button", { name: /Save current crop|保存当前裁剪/ }));
    expect(context.drawImage).toHaveBeenLastCalledWith(sourceCanvas, 0, 0, 900, 383);
    expect(onSave).toHaveBeenLastCalledWith("wide", "data:image/webp;base64,cropped");

    fireEvent.click(screen.getByRole("button", { name: /Square cover|方形封面/ }));
    expect(screen.getByTestId("wechat-cover-cropper").getAttribute("data-aspect")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /Save current crop|保存当前裁剪/ }));
    expect(context.drawImage).toHaveBeenLastCalledWith(sourceCanvas, 0, 0, 500, 500);
    expect(onSave).toHaveBeenLastCalledWith("square", "data:image/webp;base64,cropped");
  });
});
