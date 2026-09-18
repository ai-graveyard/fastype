import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStoredImages } from "@/hooks/use-image-library";

const mocks = vi.hoisted(() => ({
  saveImageDataUrl: vi.fn<(dataUrl: string) => Promise<string | null>>(),
}));

vi.mock("@/lib/image/library", () => ({
  loadImages: vi.fn(async () => {}),
  peekImageDataUrl: vi.fn(() => null),
  pinImages: vi.fn(() => () => {}),
  resolveImageRefs: vi.fn((value: string) => value),
  resolveImageRefValue: vi.fn((value: string) => value),
  saveImageDataUrl: mocks.saveImageDataUrl,
}));

const RED_PIXEL = "data:image/png;base64,cmVk";
const BLUE_PIXEL = "data:image/png;base64,Ymx1ZQ==";
const RED_REF = "fastype-img:0000000000000001";
const BLUE_REF = "fastype-img:0000000000000002";
const FIELDS = ["avatar"] as const;

interface Profile {
  avatar: string;
  name: string;
  theme: string;
}

function Harness({ onSave }: { onSave: (profile: Profile) => void }) {
  const [record, setRecord] = React.useState<Profile>({
    avatar: "/default.png",
    name: "原名",
    theme: "light",
  });
  const save = React.useCallback(
    (next: Profile) => {
      setRecord(next);
      onSave(next);
    },
    [onSave],
  );
  const [, store] = useStoredImages(record, FIELDS, save);

  return (
    <>
      <span data-testid="record">{JSON.stringify(record)}</span>
      <button
        type="button"
        onClick={() => store({ avatar: RED_PIXEL, name: "旧名字", theme: "light" })}
      >
        旧设置
      </button>
      <button
        type="button"
        onClick={() => store({ avatar: BLUE_PIXEL, name: "新名字", theme: "dark" })}
      >
        新设置
      </button>
    </>
  );
}

describe("设置图片异步写回", () => {
  beforeEach(() => {
    mocks.saveImageDataUrl.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("迟到的旧转换不会覆盖后发设置或丢掉其它字段", async () => {
    let finishRed: (value: string | null) => void = () => {};
    const red = new Promise<string | null>((resolve) => {
      finishRed = resolve;
    });
    mocks.saveImageDataUrl.mockImplementation((dataUrl) =>
      dataUrl === RED_PIXEL ? red : Promise.resolve(BLUE_REF),
    );
    const saved: Profile[] = [];
    render(<Harness onSave={(profile) => saved.push(profile)} />);

    fireEvent.click(screen.getByRole("button", { name: "旧设置" }));
    fireEvent.click(screen.getByRole("button", { name: "新设置" }));

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("record").textContent ?? "{}")).toEqual({
        avatar: BLUE_REF,
        name: "新名字",
        theme: "dark",
      }),
    );
    finishRed(RED_REF);
    await Promise.resolve();
    await Promise.resolve();

    expect(saved).toEqual([{ avatar: BLUE_REF, name: "新名字", theme: "dark" }]);
  });
});
