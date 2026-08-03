import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import type { RefObject } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useAi } from "@/components/providers/ai-provider";
import { AppProviders } from "@/components/providers/app-providers";
import { AiTitleDialog } from "@/components/workbench/ai-title-dialog";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";

const DOCUMENT = "# 旧标题\n\n正文里有一些内容，够长到不该被当成关键词发出去。\n";

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
    getValue: vi.fn(() => DOCUMENT),
    getSelection: vi.fn(() => ({ text: "", from: 0, to: 0 })),
    getSelectionRect: vi.fn(() => null),
    subscribeSelection: vi.fn(() => () => undefined),
    getContextAround: vi.fn(() => ({ before: "", after: "" })),
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    insertAfterSelection: vi.fn(),
    replaceRange: vi.fn(() => true),
    insertAfterRange: vi.fn(() => true),
    toggleWrap: vi.fn(),
    toggleLinePrefix: vi.fn(),
    insertBlock: vi.fn(),
    getImageAtCursor: vi.fn(() => null),
    replaceImage: vi.fn(() => true),
    locateText: vi.fn(() => true),
    getScrollLine: vi.fn(() => 1),
    scrollToLine: vi.fn(),
    subscribeScroll: vi.fn(() => () => undefined),
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    configureSearch: vi.fn(() => ({ current: 0, count: 0 })),
    navigateSearch: vi.fn(() => ({ current: 0, count: 0 })),
    replaceCurrentSearch: vi.fn(() => ({ current: 0, count: 0 })),
    replaceAllSearch: vi.fn(() => ({ current: 0, count: 0 })),
    getSearchStatus: vi.fn(() => ({ current: 0, count: 0 })),
    subscribeSearchPanel: vi.fn(() => () => undefined),
    subscribeSearchUpdate: vi.fn(() => () => undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    ...overrides,
  };
}

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

function renderDialog(api: EditorApi, { configured = true } = {}) {
  const ref = { current: api } as RefObject<EditorApi | null>;
  const onOpenChange = vi.fn();
  render(
    <AppProviders>
      <SeedAiConfig configured={configured} />
      <AiTitleDialog open onOpenChange={onOpenChange} editorRef={ref} currentTitle="旧标题" />
    </AppProviders>,
  );
  return { onOpenChange };
}

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

function sentBody(fetchMock: ReturnType<typeof stubFetchOnce>) {
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as {
    stream: boolean;
    messages: Array<{ role: string; content: string }>;
  };
}

const GENERATE = /生成候选|^Generate$/;
const CANDIDATES = "候选标题一\n候选标题二\n候选标题三\n候选标题四\n候选标题五";

describe("起标题", () => {
  it("打开时先展示当前标题，不自动发请求", () => {
    const fetchMock = stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi());

    expect(screen.getByText(/旧标题/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("生成后逐条列出候选", async () => {
    stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi());

    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    await screen.findByRole("button", { name: /候选标题一/ });
    for (const name of [/候选标题二/, /候选标题三/, /候选标题四/, /候选标题五/]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("点候选只替换一级标题，正文其余部分不动", async () => {
    stubFetchOnce(CANDIDATES);
    const api = createEditorApi();
    renderDialog(api);

    fireEvent.click(screen.getByRole("button", { name: GENERATE }));
    const candidate = await screen.findByRole("button", { name: /候选标题一/ });
    expect(api.replaceDocument).not.toHaveBeenCalled();

    fireEvent.click(candidate);
    expect(api.replaceDocument).toHaveBeenCalledWith(
      "# 候选标题一\n\n正文里有一些内容，够长到不该被当成关键词发出去。\n",
    );
  });

  it("基于关键词时只发关键词，不发全文", async () => {
    const fetchMock = stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi());

    // Radix Tabs 的 Trigger 响应 mousedown，click 不会切换。
    fireEvent.mouseDown(screen.getByRole("tab", { name: /基于关键词|From keywords/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /关键词或大纲|Keywords or outline/ }), {
      target: { value: "本地部署 成本对比" },
    });
    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const user = sentBody(fetchMock).messages[1].content;
    expect(user).toContain("本地部署 成本对比");
    expect(user).not.toContain("正文里有一些内容");
  });

  it("关键词为空时不发请求", () => {
    const fetchMock = stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi());

    // Radix Tabs 的 Trigger 响应 mousedown，click 不会切换。
    fireEvent.mouseDown(screen.getByRole("tab", { name: /基于关键词|From keywords/ }));
    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("未配置模型时不发请求", () => {
    const fetchMock = stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi(), { configured: false });

    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("候选列表不走流式，整段回来再拆", async () => {
    const fetchMock = stubFetchOnce(CANDIDATES);
    renderDialog(createEditorApi());

    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).stream).toBe(false);
  });

  it("一条都没解析出来时给出提示", async () => {
    stubFetchOnce("以下是几个标题：\n");
    renderDialog(createEditorApi());

    fireEvent.click(screen.getByRole("button", { name: GENERATE }));

    expect(await screen.findByText(/没解析出可用的标题|No usable titles/)).toBeTruthy();
  });
});
