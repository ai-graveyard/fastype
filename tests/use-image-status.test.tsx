import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useImagesSettled } from "@/hooks/use-image-status";

function image(complete = false, width = 0): HTMLImageElement {
  const node = document.createElement("img");
  node.src = "/fixture.png";
  Object.defineProperties(node, {
    complete: { configurable: true, value: complete },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: width },
  });
  return node;
}

function settle(node: HTMLImageElement, event = "load") {
  Object.defineProperties(node, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: event === "load" ? 600 : 0 },
    naturalHeight: { configurable: true, value: event === "load" ? 600 : 0 },
  });
  act(() => node.dispatchEvent(new Event(event)));
}

afterEach(cleanup);

describe("useImagesSettled", () => {
  it("测量节点在图片加载期间被替换后，仍会触发重新分页", () => {
    const container = document.createElement("div");
    const oldImage = image();
    container.append(oldImage);
    const ref = { current: container };
    const { result } = renderHook(() => useImagesSettled(ref, "image"));
    const replacement = image();
    container.replaceChildren(replacement);
    settle(replacement);
    expect(result.current).toBe(1);
  });

  it("忽略已移出测量区的旧图片事件", () => {
    const container = document.createElement("div");
    const oldImage = image();
    container.append(oldImage);
    const ref = { current: container };
    const { result } = renderHook(() => useImagesSettled(ref, "image"));
    container.replaceChildren(image());
    settle(oldImage);
    expect(result.current).toBe(0);
  });

  it("所有图片成功或失败后才重排，新节点只触发一次更新", () => {
    const container = document.createElement("div");
    const first = image();
    const second = image();
    container.append(first, second);
    const ref = { current: container };
    const { result } = renderHook(() => useImagesSettled(ref, "images"));
    settle(first);
    expect(result.current).toBe(0);
    settle(second, "error");
    expect(result.current).toBe(1);
    const cached = image(true, 600);
    const failed = image(true);
    container.replaceChildren(cached, failed);
    act(() => cached.dispatchEvent(new Event("load")));
    act(() => failed.dispatchEvent(new Event("error")));
    expect(result.current).toBe(2);
    act(() => cached.dispatchEvent(new Event("load")));
    expect(result.current).toBe(2);
  });
});
