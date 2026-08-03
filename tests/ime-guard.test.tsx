import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { XhsContentEditor } from "@/components/workbench/xhs-content-editor";
import { useImeGuard } from "@/hooks/use-ime-guard";
import type { XhsMetadata } from "@/lib/markdown/xhs-frontmatter";

function TagHarness() {
  const [metadata, setMetadata] = React.useState<XhsMetadata>({
    title: "",
    content: "",
    tags: [],
  });

  return (
    <PrefsProvider>
      <XhsContentEditor
        sourceBody=""
        metadata={metadata}
        onMetadataChange={(patch) => setMetadata((current) => ({ ...current, ...patch }))}
      />
    </PrefsProvider>
  );
}

function GuardProbe({ onKey }: { onKey: (ignored: boolean) => void }) {
  const ime = useImeGuard();
  return (
    <input
      aria-label="probe"
      {...ime.compositionProps}
      onKeyDown={(event) => onKey(ime.isComposing(event))}
    />
  );
}

describe("输入法组合态守卫", () => {
  it("组合进行中的按键被判定为输入法收尾", () => {
    const seen: boolean[] = [];
    render(<GuardProbe onKey={(ignored) => seen.push(ignored)} />);
    const input = screen.getByLabelText("probe");

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(seen).toEqual([true]);
  });

  it("compositionend 之后的紧邻按键仍在宽限期内", () => {
    const seen: boolean[] = [];
    render(<GuardProbe onKey={(ignored) => seen.push(ignored)} />);
    const input = screen.getByLabelText("probe");

    fireEvent.compositionStart(input);
    // 浏览器在候选词确认时先发 compositionend，紧接着那次 keydown 的 isComposing 已经是 false。
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(seen).toEqual([true]);
  });

  it("keyCode 229 单独也足以判定", () => {
    const seen: boolean[] = [];
    render(<GuardProbe onKey={(ignored) => seen.push(ignored)} />);

    fireEvent.keyDown(screen.getByLabelText("probe"), { key: "Enter", keyCode: 229 });

    expect(seen).toEqual([true]);
  });

  it("没有输入法参与时不拦截", () => {
    const seen: boolean[] = [];
    render(<GuardProbe onKey={(ignored) => seen.push(ignored)} />);

    fireEvent.keyDown(screen.getByLabelText("probe"), { key: "Enter" });

    expect(seen).toEqual([false]);
  });
});

describe("标签输入框", () => {
  it("确认候选词的回车不会把半成品存成标签", () => {
    render(<TagHarness />);
    const tagInput = screen.getByRole("textbox", { name: /Tags|标签/ });

    fireEvent.compositionStart(tagInput);
    fireEvent.change(tagInput, { target: { value: "排版" } });
    fireEvent.compositionEnd(tagInput);
    fireEvent.keyDown(tagInput, { key: "Enter" });

    expect(screen.queryByRole("button", { name: /#排版/ })).toBeNull();
    expect((tagInput as HTMLInputElement).value).toBe("排版");
  });

  it("宽限期过后的回车照常加标签", async () => {
    render(<TagHarness />);
    const tagInput = screen.getByRole("textbox", { name: /Tags|标签/ });

    fireEvent.compositionStart(tagInput);
    fireEvent.change(tagInput, { target: { value: "排版" } });
    fireEvent.compositionEnd(tagInput);
    await new Promise((resolve) => setTimeout(resolve, 80));
    fireEvent.keyDown(tagInput, { key: "Enter" });

    expect(screen.getByRole("button", { name: /#排版/ })).toBeTruthy();
  });
});
