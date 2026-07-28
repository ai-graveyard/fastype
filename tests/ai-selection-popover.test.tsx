import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import type { RefObject } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { AppProviders } from "@/components/providers/app-providers";
import { useAi } from "@/components/providers/ai-provider";
import { AiSelectionPopover } from "@/components/workbench/ai-selection-popover";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";

const SELECTION = { text: "选中的一段话", from: 10, to: 16 };
const RECT = { top: 300, bottom: 320, left: 100, right: 260 };

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function createEditorApi(overrides: Partial<EditorApi> = {}): EditorApi {
  return {
    focus: vi.fn(),
    getValue: vi.fn(() => "正文"),
    getSelection: vi.fn(() => SELECTION),
    getSelectionRect: vi.fn(() => RECT),
    subscribeSelection: vi.fn(() => () => undefined),
    getContextAround: vi.fn(() => ({ before: "前文", after: "后文" })),
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    insertAfterSelection: vi.fn(),
    replaceRange: vi.fn(() => true),
    insertAfterRange: vi.fn(() => true),
    toggleWrap: vi.fn(),
    toggleLinePrefix: vi.fn(),
    insertBlock: vi.fn(),
    locateText: vi.fn(() => true),
    getScrollLine: vi.fn(() => 1),
    scrollToLine: vi.fn(),
    subscribeScroll: vi.fn(() => () => undefined),
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    configureSearch: vi.fn(() => ({ current: 1, count: 1 })),
    navigateSearch: vi.fn(() => ({ current: 1, count: 1 })),
    replaceCurrentSearch: vi.fn(() => ({ current: 1, count: 1 })),
    replaceAllSearch: vi.fn(() => ({ current: 0, count: 0 })),
    getSearchStatus: vi.fn(() => ({ current: 1, count: 1 })),
    subscribeSearchPanel: vi.fn(() => () => undefined),
    subscribeSearchUpdate: vi.fn(() => () => undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    ...overrides,
  };
}

/**
 * 通过 provider 写入配置，而不是塞 localStorage：
 * store 有模块级缓存，同一个测试文件里直接写盘不会被重新读取。
 */
function SeedAiConfig({ configured }: { configured: boolean }) {
  const { setConfig } = useAi();
  React.useLayoutEffect(() => {
    setConfig(
      configured
        ? {
            ...DEFAULT_AI_CONFIG,
            baseUrl: "https://example.test/v1",
            apiKey: "sk-test",
            model: "test-model",
          }
        : DEFAULT_AI_CONFIG,
    );
    // 只在挂载时播一次种。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderPopover(api: EditorApi, { configured = true } = {}) {
  const ref = { current: api } as RefObject<EditorApi | null>;
  render(
    <AppProviders>
      <SeedAiConfig configured={configured} />
      <AiSelectionPopover editorRef={ref} />
    </AppProviders>,
  );
  return ref;
}

/** 模拟一次非流式的 Chat Completions 响应。 */
function stubFetchOnce(content: string) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** 取出这次请求实际发出的消息体。 */
function sentMessages(fetchMock: ReturnType<typeof stubFetchOnce>) {
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as {
    messages: Array<{ role: string; content: string }>;
  };
}

describe("划词 AI 浮层", () => {
  it("有选区时浮出四个动作，没选区时不出现", () => {
    renderPopover(createEditorApi());
    const toolbar = screen.getByRole("toolbar", { name: /划词 AI|Selection AI/ });
    expect(toolbar).toBeTruthy();
    for (const name of [/润色|Polish/, /扩写|Expand/, /精简|Condense/, /自定义|Custom/]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("没有选区时不渲染任何浮层", () => {
    renderPopover(createEditorApi({ getSelectionRect: vi.fn(() => null) }));
    expect(screen.queryByRole("toolbar", { name: /划词 AI|Selection AI/ })).toBeNull();
  });

  it("只把选中文本和有限上下文发出去，不发整篇正文", async () => {
    const fetchMock = stubFetchOnce("润色后的文字");
    renderPopover(createEditorApi({ getValue: vi.fn(() => "整篇不该被发送的正文".repeat(50)) }));

    fireEvent.click(screen.getByRole("button", { name: /润色|Polish/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const user = sentMessages(fetchMock).messages[1].content;
    expect(user).toContain(SELECTION.text);
    expect(user).toContain("前文");
    expect(user).not.toContain("整篇不该被发送的正文");
  });

  it("生成结果不会自动写回正文，必须点替换", async () => {
    stubFetchOnce("润色后的文字");
    const api = createEditorApi();
    renderPopover(api);

    fireEvent.click(screen.getByRole("button", { name: /润色|Polish/ }));
    await screen.findByText("润色后的文字");
    expect(api.replaceRange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /替换选中内容|Replace selection/ }));
    expect(api.replaceRange).toHaveBeenCalledWith(
      SELECTION.from,
      SELECTION.to,
      "润色后的文字",
      SELECTION.text,
    );
  });

  it("生成期间原文被改动时不落笔，改为提示重选", async () => {
    stubFetchOnce("润色后的文字");
    // 范围内容对不上，编辑器拒绝写入。
    const api = createEditorApi({ replaceRange: vi.fn(() => false) });
    renderPopover(api);

    fireEvent.click(screen.getByRole("button", { name: /润色|Polish/ }));
    await screen.findByText("润色后的文字");
    fireEvent.click(screen.getByRole("button", { name: /替换选中内容|Replace selection/ }));

    expect(api.replaceRange).toHaveBeenCalled();
    // 浮层不关闭，结果还留着，用户可以复制或重新生成。
    expect(screen.getByText("润色后的文字")).toBeTruthy();
  });

  it("自定义指令要先写内容才发请求", async () => {
    const fetchMock = stubFetchOnce("结果");
    renderPopover(createEditorApi());

    fireEvent.click(screen.getByRole("button", { name: /自定义指令|Custom instruction/ }));
    const textarea = await screen.findByRole("textbox", {
      name: /自定义指令|Custom instruction/,
    });

    // 指令为空时开始按钮不可用，也没有发出任何请求。
    expect(screen.getByRole("button", { name: /开始处理|Start/ }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      fireEvent.change(textarea, { target: { value: "改成口语" } });
    });
    fireEvent.click(screen.getByRole("button", { name: /开始处理|Start/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentMessages(fetchMock).messages[1].content).toContain("改成口语");
  });

  it("按下浮层按钮不会被当成拖选而把浮层收起", async () => {
    const fetchMock = stubFetchOnce("润色后的文字");
    renderPopover(createEditorApi());

    const button = screen.getByRole("button", { name: /润色|Polish/ });
    // 真实鼠标会先发 pointerdown。早先的实现在这一步就把浮层卸载了，
    // 按钮在 mousedown 和 click 之间消失，click 永远打不到。
    fireEvent.pointerDown(button);
    expect(screen.getByRole("toolbar", { name: /划词 AI|Selection AI/ })).toBeTruthy();

    fireEvent.pointerUp(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("在编辑器里拖选的过程中先把浮层藏起来", () => {
    renderPopover(createEditorApi());
    expect(screen.getByRole("toolbar", { name: /划词 AI|Selection AI/ })).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("toolbar", { name: /划词 AI|Selection AI/ })).toBeNull();

    fireEvent.pointerUp(document.body);
    expect(screen.getByRole("toolbar", { name: /划词 AI|Selection AI/ })).toBeTruthy();
  });

  it("未配置模型时不发请求，引导去设置", () => {
    const fetchMock = stubFetchOnce("不该被调用");
    renderPopover(createEditorApi(), { configured: false });

    fireEvent.click(screen.getByRole("button", { name: /润色|Polish/ }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
