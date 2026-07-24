import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { XhsContentEditor } from "@/components/workbench/xhs-content-editor";
import type { XhsMetadata } from "@/lib/markdown/xhs-frontmatter";

function Harness({
  title = "",
  sourceBody = "",
}: {
  title?: string;
  sourceBody?: string;
}) {
  const [metadata, setMetadata] = React.useState<XhsMetadata>({
    title,
    content: "",
    tags: [],
  });

  return (
    <PrefsProvider>
      <XhsContentEditor
        sourceBody={sourceBody}
        metadata={metadata}
        onMetadataChange={(patch) => setMetadata((current) => ({ ...current, ...patch }))}
      />
    </PrefsProvider>
  );
}

describe("小红书内容编辑器", () => {
  it("直接展示标题、内容正文和标签", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: /Title|标题/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Text body|正文/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Tags|标签/ })).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("编辑标题、正文并增删标签", () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole("textbox", { name: /Title|标题/ }), {
      target: { value: "内容标题" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Text body|正文/ }), {
      target: { value: "发布正文" },
    });

    const tagInput = screen.getByRole("textbox", { name: /Tags|标签/ });
    fireEvent.change(tagInput, { target: { value: "AI" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });

    expect(screen.getByDisplayValue("内容标题")).toBeTruthy();
    expect(screen.getByDisplayValue("发布正文")).toBeTruthy();
    expect(screen.getByRole("button", { name: /#AI/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /#AI/ }));
    expect(screen.queryByRole("button", { name: /#AI/ })).toBeNull();
  });

  it("只对内容正文标题应用标题限制", () => {
    render(
      <Harness title="这是一个超过二十个字的内容正文标题用于验证范围" />,
    );

    expect(
      screen.getByRole("textbox", { name: /Title|标题/ }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.getByText(/23\/20 (chars|字)/)).toBeTruthy();
  });

  it("点击自动填充后取一级标题作为标题、正文纯文本作为内容", () => {
    render(
      <Harness sourceBody={"# 我的标题\n\n第一段。\n\n第二段。"} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Auto-fill|自动填充/ }));

    const titleInput = screen.getByRole("textbox", {
      name: /Title|标题/,
    }) as HTMLInputElement;
    const contentInput = screen.getByRole("textbox", {
      name: /Text body|正文/,
    }) as HTMLTextAreaElement;

    expect(titleInput.value).toBe("我的标题");
    expect(contentInput.value).not.toContain("我的标题");
    expect(contentInput.value).toContain("第一段。");
    expect(contentInput.value).toContain("第二段。");
  });

  it("图片正文为空时禁用自动填充按钮", () => {
    render(<Harness sourceBody="   " />);
    expect(
      screen.getByRole("button", { name: /Auto-fill|自动填充/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

});
