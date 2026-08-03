import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { XhsPreview, type XhsPreviewHandle } from "@/components/workbench/xhs-preview";
import { XHS_QR_CODE_CONTENT_GAP, xhsQrCodeHeight } from "@/components/workbench/xhs-qr-code";
import { detectLocale } from "@/lib/i18n";
import { DEFAULT_XHS_STYLE } from "@/lib/themes/xhs";
import { getDefaultUserProfile } from "@/lib/user-profile";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

describe("小红书内容正文预览", () => {
  it("在预览左下角提供缩放与重置控制", () => {
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            html=""
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={DEFAULT_XHS_STYLE}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const zoomOut = screen.getByTitle(/缩小预览|Zoom out/);
    const zoomIn = screen.getByTitle(/放大预览|Zoom in/);
    const zoomReset = screen.getByTitle(/恢复 100%|Reset to 100%/);
    const previewStage = screen.getByTestId("xhs-preview-stage");

    expect(screen.getByText("100%")).toBeTruthy();
    expect(previewStage.classList.contains("pt-4")).toBe(true);
    expect(previewStage.classList.contains("pb-12")).toBe(true);
    expect(screen.getByTestId("phone-battery-icon").getAttribute("viewBox")).toBe("0 0 25 12");
    expect(screen.getByTestId("phone-battery-level").getAttribute("width")).toBe("14.4");
    expect(zoomReset.hasAttribute("disabled")).toBe(true);

    fireEvent.click(zoomIn);
    expect(screen.getByText("110%")).toBeTruthy();
    expect(zoomReset.hasAttribute("disabled")).toBe(false);

    fireEvent.click(zoomReset);
    expect(screen.getByText("100%")).toBeTruthy();

    for (let index = 0; index < 5; index += 1) fireEvent.click(zoomOut);
    expect(screen.getByText("50%")).toBeTruthy();
    expect(zoomOut.hasAttribute("disabled")).toBe(true);
  });

  it("支持用鼠标拖动图片左右翻页", async () => {
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            html="<p>图片正文</p>"
            documentTitle="拖动预览"
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
            }}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const carousel = await screen.findByTestId("xhs-swipe-carousel");
    await waitFor(() => expect(within(carousel).getByText("1/2")).toBeTruthy());

    fireEvent.pointerDown(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 280,
    });
    fireEvent.pointerMove(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 1,
      pointerType: "mouse",
      buttons: 1,
      clientX: 140,
    });
    fireEvent.pointerUp(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 140,
    });

    await waitFor(() => expect(within(carousel).getByText("2/2")).toBeTruthy());

    fireEvent.pointerDown(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 2,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
    });
    fireEvent.pointerMove(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 2,
      pointerType: "mouse",
      buttons: 1,
      clientX: 240,
    });
    fireEvent.pointerUp(screen.getByTestId("xhs-swipe-track"), {
      pointerId: 2,
      pointerType: "mouse",
      button: 0,
      clientX: 240,
    });

    await waitFor(() => expect(within(carousel).getByText("1/2")).toBeTruthy());
  });

  it("渲染独立的标题、正文和标签，并跟随元数据更新", () => {
    const onPagesChange = vi.fn();
    const { container, rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            html=""
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "发布标题", content: "第一段\n第二段", tags: ["AI", "效率"] }}
            style={DEFAULT_XHS_STYLE}
            onPagesChange={onPagesChange}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(within(article!).getByText("发布标题")).toBeTruthy();
    expect(within(article!).getByText(/第一段\s*第二段/)).toBeTruthy();
    expect(within(article!).getByText("#AI")).toBeTruthy();
    expect(within(article!).getByText("#效率")).toBeTruthy();

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            html=""
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "新标题", content: "新正文", tags: ["新标签"] }}
            style={DEFAULT_XHS_STYLE}
            onPagesChange={onPagesChange}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const updatedArticle = container.querySelector("article");
    expect(updatedArticle).not.toBeNull();
    expect(within(updatedArticle!).getByText("新标题")).toBeTruthy();
    expect(within(updatedArticle!).getByText("新正文")).toBeTruthy();
    expect(within(updatedArticle!).getByText("#新标签")).toBeTruthy();
  });

  it("把用户标识渲染进预览与导出共用的卡片节点", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>图片正文</p>"
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                position: "bottom-right",
              },
            }}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(1));
    const page = previewRef.current!.getPageNodes()[0];
    const identifier = page.querySelector(".ft-xhs-identifier");
    expect(identifier?.getAttribute("data-position")).toBe("bottom-right");
    expect((identifier as HTMLElement | null)?.style.transform).toBe("");
    expect(identifier?.textContent).toContain("FasType");
    const locale = detectLocale(navigator.languages ?? [navigator.language]);
    expect(identifier?.textContent).toContain(getDefaultUserProfile(locale).slogan);
    const avatar = identifier?.querySelector(".ft-xhs-identifier-avatar") as HTMLElement | null;
    const text = identifier?.querySelector(".ft-xhs-identifier-text") as HTMLElement | null;
    expect(avatar?.style.transform).toBe("translateY(-4px)");
    expect(text?.style.height).toBe("80px");
    expect(text?.classList.contains("justify-center")).toBe(true);
    const [name, meta] = identifier?.querySelectorAll("p") ?? [];
    expect(name?.style.fontSize).toBe("36px");
    expect(name?.style.marginTop).toBe("0px");
    expect(name?.style.marginRight).toBe("0px");
    expect(name?.style.marginBottom).toBe("0px");
    expect(name?.style.marginLeft).toBe("0px");
    expect(name?.style.textIndent).toBe("0px");
    expect(meta?.style.marginTop).toBe("8px");
    expect(meta?.style.marginBottom).toBe("0px");
    expect(meta?.style.textIndent).toBe("0px");
  });

  it("底部用户标识、二维码和页脚分别占据独立空间", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const style = {
      ...DEFAULT_XHS_STYLE,
      identifier: {
        ...DEFAULT_XHS_STYLE.identifier,
        position: "bottom-left" as const,
      },
      qrCode: {
        ...DEFAULT_XHS_STYLE.qrCode,
        enabled: true,
        url: "https://fastype.example",
        position: "bottom-right" as const,
      },
    };

    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>图片正文</p>"
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={style}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(1));
    const page = previewRef.current!.getPageNodes()[0];
    const body = page.querySelector(".ft-xhs-body");
    const identifier = page.querySelector(".ft-xhs-identifier");
    const footer = page.querySelector(".ft-xhs-footer");
    expect(body).not.toBeNull();
    expect(identifier).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(body!.compareDocumentPosition(identifier!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(identifier!.compareDocumentPosition(footer!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const qrCode = await waitFor(() => {
      const node = page.querySelector('[aria-label="https://fastype.example"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(identifier!.compareDocumentPosition(qrCode)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(qrCode.compareDocumentPosition(footer!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(qrCode.classList.contains("absolute")).toBe(false);
    expect(qrCode.style.position).toBe("");
    expect(qrCode.style.marginTop).toBe(`${XHS_QR_CODE_CONTENT_GAP * style.qrCode.scale}px`);
    expect(qrCode.style.width).toBe(`${xhsQrCodeHeight(style.qrCode)}px`);
    expect(qrCode.style.height).toBe(`${xhsQrCodeHeight(style.qrCode)}px`);
    expect(qrCode.style.alignSelf).toBe("flex-end");
  });

  it("默认不在封面展示用户标识，开启后才渲染", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const baseProps = {
      ref: previewRef,
      html: "<p>图片正文</p>",
      documentTitle: "封面标题",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: false,
      exporting: false,
    };
    const { rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    let [cover, body] = previewRef.current!.getPageNodes();
    const coverTitle = cover.querySelector("h1") as HTMLElement;
    expect(cover.style.padding).toBe(`${DEFAULT_XHS_STYLE.padding}px`);
    expect(coverTitle.parentElement?.style.marginInline).toBe(
      `${48 - DEFAULT_XHS_STYLE.padding}px`,
    );
    expect(coverTitle.style.width).toBe("100%");
    expect(coverTitle.style.whiteSpace).toBe("pre-wrap");
    expect(coverTitle.style.wordBreak).toBe("normal");
    expect(coverTitle.style.overflowWrap).toBe("anywhere");
    expect(cover.querySelector(".ft-xhs-identifier")).toBeNull();
    expect(body.querySelector(".ft-xhs-identifier")).not.toBeNull();

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
              identifier: { ...DEFAULT_XHS_STYLE.identifier, showOnCover: true },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => {
      [cover, body] = previewRef.current!.getPageNodes();
      expect(cover.querySelector(".ft-xhs-identifier")).not.toBeNull();
    });
    expect(body.querySelector(".ft-xhs-identifier")).not.toBeNull();
  });

  it("封面默认没有装饰图形，用户添加的 Lucide 图形会进入导出节点", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const baseProps = {
      ref: previewRef,
      html: "<p>图片正文</p>",
      documentTitle: "图形封面",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: false,
      exporting: false,
    };
    const { rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    let [cover] = previewRef.current!.getPageNodes();
    expect(cover.querySelector(".ft-xhs-cover-graphics")).toBeNull();
    expect(cover.querySelector(":scope > span")).toBeNull();

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: {
                ...DEFAULT_XHS_STYLE.cover,
                enabled: true,
                graphics: [
                  {
                    id: "star-1",
                    icon: "star",
                    x: 80,
                    y: 20,
                    size: 180,
                    rotation: 15,
                    color: "#ffffff",
                    opacity: 0.8,
                    strokeWidth: 2.5,
                  },
                ],
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => {
      [cover] = previewRef.current!.getPageNodes();
      expect(cover.querySelector('[data-cover-graphic="star"]')).not.toBeNull();
    });
    const graphic = cover.querySelector('[data-cover-graphic="star"]') as HTMLElement;
    expect(graphic.style.left).toBe("80%");
    expect(graphic.style.top).toBe("20%");
    expect(graphic.style.width).toBe("180px");
    expect(graphic.querySelector("svg")).not.toBeNull();
  });

  it("封面的标识、二维码和页脚复用正文卡片的同一组位置", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const style = {
      ...DEFAULT_XHS_STYLE,
      cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
      identifier: {
        ...DEFAULT_XHS_STYLE.identifier,
        position: "bottom-left" as const,
        showOnCover: true,
      },
      qrCode: {
        ...DEFAULT_XHS_STYLE.qrCode,
        enabled: true,
        showOnCover: true,
        url: "https://fastype.example/shared-position",
        position: "bottom-right" as const,
      },
      showPageNumberOnCover: true,
    };

    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>图片正文</p>"
            documentTitle="封面标题"
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={style}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    const [cover, body] = previewRef.current!.getPageNodes();
    expect(cover.style.padding).toBe(body.style.padding);

    const coverIdentifier = cover.querySelector(".ft-xhs-identifier");
    const bodyIdentifier = body.querySelector(".ft-xhs-identifier");
    expect(coverIdentifier?.getAttribute("data-position")).toBe("bottom-left");
    expect(coverIdentifier?.getAttribute("data-position")).toBe(
      bodyIdentifier?.getAttribute("data-position"),
    );
    expect((coverIdentifier as HTMLElement).style.marginTop).toBe(
      (bodyIdentifier as HTMLElement).style.marginTop,
    );

    const [coverQrCode, bodyQrCode] = await waitFor(() => {
      const nodes = [cover, body].map(
        (page) =>
          page.querySelector(
            '[aria-label="https://fastype.example/shared-position"]',
          ) as HTMLElement | null,
      );
      expect(nodes.every(Boolean)).toBe(true);
      return nodes as [HTMLElement, HTMLElement];
    });
    expect(coverQrCode.getAttribute("data-position")).toBe("bottom-right");
    expect(coverQrCode.getAttribute("data-position")).toBe(
      bodyQrCode.getAttribute("data-position"),
    );
    expect(coverQrCode.style.marginTop).toBe(bodyQrCode.style.marginTop);
    expect(coverQrCode.style.width).toBe(bodyQrCode.style.width);
    expect(coverQrCode.style.height).toBe(bodyQrCode.style.height);
    expect(coverQrCode.style.alignSelf).toBe(bodyQrCode.style.alignSelf);

    const coverFooter = cover.querySelector(".ft-xhs-footer") as HTMLElement;
    const bodyFooter = body.querySelector(".ft-xhs-footer") as HTMLElement;
    expect(coverFooter.className).toBe(bodyFooter.className);
    expect(coverFooter.style.transform).toBe(bodyFooter.style.transform);
  });

  it("封面隐藏页脚时，底部二维码仍与正文二维码保持同一流式位置", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const style = {
      ...DEFAULT_XHS_STYLE,
      cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
      qrCode: {
        ...DEFAULT_XHS_STYLE.qrCode,
        enabled: true,
        showOnCover: true,
        url: "https://fastype.example/shared-bottom",
        position: "bottom-right" as const,
      },
      showPageNumberOnCover: false,
    };

    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>图片正文</p>"
            documentTitle="封面标题"
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={style}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    const [cover, body] = previewRef.current!.getPageNodes();
    const [coverQrCode, bodyQrCode] = await waitFor(() => {
      const nodes = [cover, body].map(
        (page) =>
          page.querySelector(
            '[aria-label="https://fastype.example/shared-bottom"]',
          ) as HTMLElement | null,
      );
      expect(nodes.every(Boolean)).toBe(true);
      return nodes as [HTMLElement, HTMLElement];
    });

    expect(cover.querySelector(".ft-xhs-footer")).toBeNull();
    expect(body.querySelector(".ft-xhs-footer")).not.toBeNull();
    expect(coverQrCode.classList.contains("absolute")).toBe(false);
    expect(bodyQrCode.classList.contains("absolute")).toBe(false);
    expect(coverQrCode.style.marginTop).toBe(bodyQrCode.style.marginTop);
    expect(coverQrCode.style.height).toBe(bodyQrCode.style.height);
    expect(coverQrCode.style.alignSelf).toBe(bodyQrCode.style.alignSelf);
  });

  it("二维码默认不在封面展示，开启后才渲染", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const baseProps = {
      ref: previewRef,
      html: "<p>图片正文</p>",
      documentTitle: "封面标题",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: false,
      exporting: false,
    };
    const qrCode = {
      ...DEFAULT_XHS_STYLE.qrCode,
      enabled: true,
      url: "https://fastype.example/cover",
    };
    const { rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
              qrCode,
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    let [cover, body] = previewRef.current!.getPageNodes();
    await waitFor(() =>
      expect(body.querySelector('[aria-label="https://fastype.example/cover"]')).not.toBeNull(),
    );
    expect(cover.querySelector('[aria-label="https://fastype.example/cover"]')).toBeNull();

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
              qrCode: { ...qrCode, showOnCover: true },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => {
      [cover, body] = previewRef.current!.getPageNodes();
      expect(cover.querySelector('[aria-label="https://fastype.example/cover"]')).not.toBeNull();
    });
    expect(body.querySelector('[aria-label="https://fastype.example/cover"]')).not.toBeNull();
  });

  it("封面不显示页码时不计入页码总数，开启后才加入计数", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    const baseProps = {
      ref: previewRef,
      html: "<p>图片正文</p>",
      documentTitle: "封面标题",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: false,
      exporting: false,
    };
    const { rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    let [cover, body] = previewRef.current!.getPageNodes();
    expect(cover.querySelector(".ft-xhs-footer")).toBeNull();
    expect(body.querySelector(".ft-xhs-footer")?.textContent).toBe("1 / 1");

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...baseProps}
            style={{
              ...DEFAULT_XHS_STYLE,
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true },
              showPageNumberOnCover: true,
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => {
      [cover, body] = previewRef.current!.getPageNodes();
      expect(cover.querySelector(".ft-xhs-footer")?.textContent).toBe("1 / 2");
    });
    expect(body.querySelector(".ft-xhs-footer")?.textContent).toBe("2 / 2");
  });

  it("没有一级标题时不补标题，图片页脚也只显示页码", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>只有正文</p>"
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={DEFAULT_XHS_STYLE}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(1));
    const page = previewRef.current!.getPageNodes()[0];
    expect(page.querySelector("h1")).toBeNull();
    expect(page.querySelector(".ft-xhs-body")?.textContent).toBe("只有正文");
    expect(page.querySelector(".ft-xhs-footer")?.textContent).toBe("1 / 1");
  });

  it("设置了自定义正文标题时，会替换正文里的一级标题，不依赖 Markdown 原文", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<h1>Markdown 里的标题</h1><p>正文段落</p>"
            documentTitle="Markdown 里的标题"
            hasTitle
            metadata={{ title: "", content: "", tags: [] }}
            style={{ ...DEFAULT_XHS_STYLE, bodyTitleOverride: "我自己重新输入的标题" }}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(1));
    const page = previewRef.current!.getPageNodes()[0];
    expect(page.querySelector("h1")?.textContent).toBe("我自己重新输入的标题");
    expect(page.textContent).not.toContain("Markdown 里的标题");
    expect(page.querySelector(".ft-xhs-body")?.textContent).toContain("正文段落");
  });

  it("正文没有一级标题时，自定义标题也能单独补上", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>只有正文</p>"
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={{ ...DEFAULT_XHS_STYLE, bodyTitleOverride: "补充的标题" }}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(1));
    const page = previewRef.current!.getPageNodes()[0];
    expect(page.querySelector("h1")?.textContent).toBe("补充的标题");
  });

  it("封面开启且隐藏正文标题时，自定义标题也会一并隐藏", async () => {
    const previewRef = createRef<XhsPreviewHandle>();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            ref={previewRef}
            html="<p>正文段落</p>"
            documentTitle=""
            hasTitle={false}
            metadata={{ title: "", content: "", tags: [] }}
            style={{
              ...DEFAULT_XHS_STYLE,
              bodyTitleOverride: "自定义标题",
              cover: { ...DEFAULT_XHS_STYLE.cover, enabled: true, hideBodyTitle: true },
            }}
            onPagesChange={vi.fn()}
            onExport={vi.fn()}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    await waitFor(() => expect(previewRef.current?.getPageNodes()).toHaveLength(2));
    const [, body] = previewRef.current!.getPageNodes();
    expect(body.querySelector("h1")).toBeNull();
  });

  it("仅在昵称徽章开关开启时渲染选中的 LoveType 徽章", () => {
    const props = {
      html: "<p>图片正文</p>",
      documentTitle: "",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: true,
      exporting: false,
    };
    const { container, rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: false,
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    expect(container.querySelector('[data-testid="xhs-identifier-badge"]')).toBeNull();

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: true,
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    expect(container.querySelectorAll('[data-testid="xhs-identifier-badge"]')).not.toHaveLength(0);
  });

  it("徽章始终是线性图标，只描边不填充，并使用徽章色", () => {
    const props = {
      html: "<p>图片正文</p>",
      documentTitle: "",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: true,
      exporting: false,
    };
    const { container } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: true,
                badgeColor: "#ff2442",
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const badge = container.querySelector('[data-testid="xhs-identifier-badge"]');
    expect(badge?.tagName.toLowerCase()).toBe("svg");
    expect(badge?.getAttribute("fill")).toBe("none");
    expect(badge?.getAttribute("stroke-width")).toBe("2");
    expect((badge as SVGElement).style.color).toBe("rgb(255, 36, 66)");
  });

  it("徽章粗细可调，对应图标的 strokeWidth", () => {
    const props = {
      html: "<p>图片正文</p>",
      documentTitle: "",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: true,
      exporting: false,
    };
    const { container } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: true,
                badgeStrokeWidth: 3,
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    const badge = container.querySelector('[data-testid="xhs-identifier-badge"]');
    expect(badge?.getAttribute("stroke-width")).toBe("3");
  });

  it("放大徽章不会撑高昵称这一行，不会把签名往下挤", () => {
    const props = {
      html: "<p>图片正文</p>",
      documentTitle: "",
      hasTitle: false,
      metadata: { title: "", content: "", tags: [] },
      onPagesChange: vi.fn(),
      onExport: vi.fn(),
      onExportPage: vi.fn(),
      exportDisabled: true,
      exporting: false,
    };
    const { container, rerender } = render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: true,
                badgeScale: 1,
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );
    const nameLineAtBaseScale = container.querySelector(".ft-xhs-identifier-text p");
    const baseHeight = (nameLineAtBaseScale as HTMLElement).style.height;

    rerender(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            {...props}
            style={{
              ...DEFAULT_XHS_STYLE,
              identifier: {
                ...DEFAULT_XHS_STYLE.identifier,
                badge: "crown",
                badgeEnabled: true,
                badgeScale: 1.5,
              },
            }}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );
    const nameLineAtLargeScale = container.querySelector(".ft-xhs-identifier-text p");
    expect((nameLineAtLargeScale as HTMLElement).style.height).toBe(baseHeight);

    const badge = container.querySelector('[data-testid="xhs-identifier-badge"]');
    expect((badge as HTMLElement).style.height).not.toBe(baseHeight);
  });
  // 直接把 onExport 挂到 onClick 上会让 React 把 MouseEvent 当作「导出第几页」传进去，
  // 上层 slice(event, event + 1) 得到空数组，点「导出」会毫无反应地静默失败。
  it("点「导出」时不把点击事件当成页码传出去", () => {
    const onExport = vi.fn();
    render(
      <PrefsProvider>
        <UserProfileProvider>
          <XhsPreview
            html="<p>正文</p>"
            documentTitle="标题"
            hasTitle
            metadata={{ title: "", content: "", tags: [] }}
            style={DEFAULT_XHS_STYLE}
            onPagesChange={vi.fn()}
            onExport={onExport}
            onExportPage={vi.fn()}
            exportDisabled={false}
            exporting={false}
          />
        </UserProfileProvider>
      </PrefsProvider>,
    );

    fireEvent.click(screen.getByTitle(/导出全部|Export all/));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0]).toEqual([]);
  });
});
