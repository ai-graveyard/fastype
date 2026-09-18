import { describe, expect, it, vi } from "vitest";

import { saveWithPicker, writeToHandle } from "@/lib/file";

function handleWith(
  permission: PermissionState,
  writable?: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> },
): FileSystemFileHandle {
  return {
    queryPermission: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue(permission),
    createWritable: vi.fn().mockResolvedValue(writable),
  } as unknown as FileSystemFileHandle;
}

describe("File System Access 写回", () => {
  it("获得权限后完整写入并关闭文件", async () => {
    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const handle = handleWith("granted", writable);

    await expect(writeToHandle(handle, "# 正文")).resolves.toMatchObject({
      ok: true,
      wroteToFile: true,
    });
    expect(writable.write).toHaveBeenCalledWith("# 正文");
    expect(writable.close).toHaveBeenCalledOnce();
  });

  it("用户拒绝写权限时按取消处理，不创建 writable", async () => {
    const handle = handleWith("denied");
    await expect(writeToHandle(handle, "# 正文")).resolves.toEqual({
      ok: false,
      canceled: true,
    });
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it("浏览器不支持保存选择器时要求调用方降级下载", async () => {
    const fileWindow = window as Window & { showSaveFilePicker?: unknown };
    const original = fileWindow.showSaveFilePicker;
    Object.defineProperty(fileWindow, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
    await expect(saveWithPicker("# 正文", "文章.md")).resolves.toEqual({
      ok: true,
      wroteToFile: false,
    });
    Object.defineProperty(fileWindow, "showSaveFilePicker", {
      value: original,
      configurable: true,
    });
  });
});
