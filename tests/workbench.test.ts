import { afterEach, describe, expect, it, vi } from "vitest";

import { writeWechatClipboard } from "@/components/workbench/workbench";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function stubClipboard(write: ReturnType<typeof vi.fn>, writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write, writeText },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("公众号剪贴板写入", () => {
  it("ClipboardItem 不可用时降级写入纯文本", async () => {
    const write = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(write, writeText);
    vi.stubGlobal("ClipboardItem", undefined);

    await expect(writeWechatClipboard("<p>正文</p>", "正文")).resolves.toBe("plain");
    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("正文");
  });

  it("富文本写入失败时继续尝试纯文本", async () => {
    const write = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(write, writeText);
    vi.stubGlobal("ClipboardItem", class {});

    await expect(writeWechatClipboard("<p>正文</p>", "正文")).resolves.toBe("plain");
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("正文");
  });

  it("富文本写入成功时不重复写入纯文本", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubClipboard(write, writeText);
    vi.stubGlobal("ClipboardItem", class {});

    await expect(writeWechatClipboard("<p>正文</p>", "正文")).resolves.toBe("rich");
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });
});
