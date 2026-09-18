import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useStoredImages } from "@/hooks/use-image-library";
import { __resetImageDbForTests, listImageStamps } from "@/lib/image/db";
import { __resetImageCacheForTests } from "@/lib/image/library";
import { isImageRef } from "@/lib/image/ref";

/**
 * 头像和公众号封面走的是同一个钩子，这里直接测它：既省得为两个 provider 各搭一套模块级
 * store 的重置，也更接近它真正要保证的那件事——落盘的是引用，交给下游的是 data URI。
 */

const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const BLUE_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==";
const DEFAULT_AVATAR = "/fastype-logo.png";

interface Profile {
  avatar: string;
  name: string;
}

const FIELDS = ["avatar"] as const;

/** 模拟真实 provider：store() 写回去，写回去的那份再作为下一轮的输入。 */
function Harness({ initial, onStore }: { initial: Profile; onStore?: (next: Profile) => void }) {
  const [stored, setStored] = React.useState(initial);
  const save = React.useCallback(
    (next: Profile) => {
      setStored(next);
      onStore?.(next);
    },
    [onStore],
  );
  const [profile, store] = useStoredImages(stored, FIELDS, save);

  return (
    <>
      <span data-testid="stored">{stored.avatar}</span>
      <span data-testid="resolved">{profile.avatar}</span>
      <span data-testid="name">{profile.name}</span>
      <button type="button" onClick={() => store({ ...profile, avatar: BLUE_PIXEL })}>
        换头像
      </button>
      <button type="button" onClick={() => store({ ...profile, name: "改了名字" })}>
        改名
      </button>
    </>
  );
}

const stored = () => screen.getByTestId("stored").textContent ?? "";
const resolved = () => screen.getByTestId("resolved").textContent ?? "";

describe("设置里的图片存进 IndexedDB", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  afterEach(() => {
    cleanup();
    __resetImageDbForTests();
    __resetImageCacheForTests();
  });

  /** 升级前的头像是一整串 base64，正是它和正文一起挤占那 5 MB。 */
  it("旧记录里的内嵌 base64 换成引用，对外仍然给 data URI", async () => {
    render(<Harness initial={{ avatar: RED_PIXEL, name: "我" }} />);

    await waitFor(() => expect(isImageRef(stored())).toBe(true));
    expect(resolved()).toBe(RED_PIXEL);
    expect(await listImageStamps()).toHaveLength(1);
  });

  it("保存新裁好的图时先入库，落盘的是引用", async () => {
    render(<Harness initial={{ avatar: DEFAULT_AVATAR, name: "我" }} />);
    expect(stored()).toBe(DEFAULT_AVATAR);

    fireEvent.click(screen.getByRole("button", { name: "换头像" }));

    await waitFor(() => expect(isImageRef(stored())).toBe(true));
    expect(resolved()).toBe(BLUE_PIXEL);
  });

  /** 改个昵称回传的是解析后的 data URI，不去重的话每保存一次就多存一张一样的图。 */
  it("改别的字段重复保存，不会把同一张图再存一份", async () => {
    render(<Harness initial={{ avatar: RED_PIXEL, name: "我" }} />);
    await waitFor(() => expect(isImageRef(stored())).toBe(true));
    const ref = stored();

    fireEvent.click(screen.getByRole("button", { name: "改名" }));
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("改了名字"));

    expect(stored()).toBe(ref);
    expect(await listImageStamps()).toHaveLength(1);
  });

  it("默认头像那种普通路径原样留着，不会被当成图片收进库", async () => {
    render(<Harness initial={{ avatar: DEFAULT_AVATAR, name: "我" }} />);

    await act(async () => {});

    expect(stored()).toBe(DEFAULT_AVATAR);
    expect(resolved()).toBe(DEFAULT_AVATAR);
    expect(await listImageStamps()).toHaveLength(0);
  });

  it("IndexedDB 用不了时头像原样内嵌，功能不受影响", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    __resetImageDbForTests();

    render(<Harness initial={{ avatar: RED_PIXEL, name: "我" }} />);
    await act(async () => {});

    expect(stored()).toBe(RED_PIXEL);
    expect(resolved()).toBe(RED_PIXEL);
  });
});
