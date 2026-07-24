import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentProvider, useDocument } from "@/components/providers/document-provider";
import { PrefsProvider } from "@/components/providers/prefs-provider";
import { StorageKey } from "@/lib/storage";

function EditorHarness() {
  const { autoSavePending, setContent } = useDocument();
  return (
    <>
      <span data-testid="auto-save-state">{autoSavePending ? "pending" : "saved"}</span>
      <button type="button" onClick={() => setContent("first")}>
        first
      </button>
      <button type="button" onClick={() => setContent("latest")}>
        latest
      </button>
    </>
  );
}

describe("文档自动保存", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("编辑期间每 3 秒保存一次最新内容", () => {
    render(
      <PrefsProvider>
        <DocumentProvider>
          <EditorHarness />
        </DocumentProvider>
      </PrefsProvider>,
    );

    expect(screen.getByTestId("auto-save-state").textContent).toBe("saved");
    fireEvent.click(screen.getByRole("button", { name: "first" }));
    expect(screen.getByTestId("auto-save-state").textContent).toBe("pending");
    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.click(screen.getByRole("button", { name: "latest" }));
    act(() => vi.advanceTimersByTime(999));
    expect(window.localStorage.getItem(StorageKey.draft)).toBeNull();
    expect(screen.getByTestId("auto-save-state").textContent).toBe("pending");

    act(() => vi.advanceTimersByTime(1));
    const saved = JSON.parse(window.localStorage.getItem(StorageKey.draft) ?? "null") as {
      data?: { content?: string };
    } | null;
    expect(saved?.data?.content).toBe("latest");
    expect(screen.getByTestId("auto-save-state").textContent).toBe("saved");
  });
});
