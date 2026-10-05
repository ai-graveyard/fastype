"use client";

import * as React from "react";
import { toast } from "sonner";

import { usePrefs } from "@/components/providers/prefs-provider";
import { useStyles } from "@/components/providers/style-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { ScaledCoverPreview } from "@/components/workbench/wechat-cover-editor";
import type { WechatCover } from "@/lib/wechat-cover";
import { XhsPreview } from "@/components/workbench/xhs-preview";
import { useElementWidth } from "@/hooks/use-media-query";
import { useDiagrams } from "@/hooks/use-rich-blocks";
import { renderMarkdown } from "@/lib/markdown/parse";
import { DEFAULT_XHS_METADATA } from "@/lib/markdown/xhs-frontmatter";
import { renderWechat } from "@/lib/render/wechat";
import {
  SCENES,
  sceneXhsStyle,
  sceneWechatStyle,
  sceneWechatCover,
  type SceneId,
} from "@/lib/themes/scenes";
import type { WechatStyle } from "@/lib/themes/wechat";
import type { ViewId } from "@/lib/types";
import { isDarkColor } from "@/lib/utils";

const noop = () => {};

function WechatBodyThumbnail({ html, style }: { html: string; style: WechatStyle }) {
  const { t } = usePrefs();
  const ref = React.useRef<HTMLDivElement>(null);
  const [articleRef, articleWidth] = useElementWidth<HTMLDivElement>();
  const innerHtml = React.useMemo(() => ({ __html: html }), [html]);
  useDiagrams(ref, html, {
    dark: isDarkColor(style.codeBackground),
    diagramErrorLabel: t("diagram.failed"),
  });
  return (
    <div
      ref={articleRef}
      className="relative aspect-[3/4] min-w-0 overflow-hidden"
      data-testid="scene-wechat-body-thumbnail"
      style={{ background: style.pageBackground }}
    >
      <div
        ref={ref}
        style={{
          width: 390,
          transform: `scale(${articleWidth / 390})`,
          transformOrigin: "top left",
        }}
        dangerouslySetInnerHTML={innerHtml}
      />
    </div>
  );
}

function WechatArticlePreview({
  sections,
  style,
  cover,
  title,
}: {
  sections: string[];
  style: WechatStyle;
  cover: WechatCover;
  title: string;
}) {
  const { profile } = useUserProfile();
  return (
    <div
      className="grid grid-cols-4 items-center gap-4 overflow-hidden bg-muted p-3"
      data-testid="scene-wechat-preview"
    >
      <ScaledCoverPreview
        cover={cover}
        format="wide"
        title={title}
        avatar={profile.avatar}
        profileName={profile.name}
        showSafeArea={false}
      />
      {sections.map((html, index) => (
        <WechatBodyThumbnail key={index} html={html} style={style} />
      ))}
    </div>
  );
}

export function ScenePicker({
  view,
  keepHeadings,
  onClose,
}: {
  view: ViewId;
  keepHeadings: boolean;
  onClose: () => void;
}) {
  const { t, locale } = usePrefs();
  const { profile } = useUserProfile();
  const { xhs, wechat, wechatCover, setXhs, setWechat, setWechatCover } = useStyles();
  const sample = React.useMemo(() => renderMarkdown(t("creator.sceneSample")), [t]);
  const previewHtml = sample.html.replace(/<h2\b/g, '<h2 data-page-break-before="true"');
  const previewTitle = sample.title ?? "";
  const sections = sample.html.split(/(?=<h2\b)/).slice(1);
  const styles = React.useMemo(
    () =>
      SCENES.map((item) => ({
        ...item,
        xhs: sceneXhsStyle(item.id, xhs),
        wechat: sceneWechatStyle(item.id, wechat, locale),
      })),
    [xhs, wechat, locale],
  );
  const apply = (id: SceneId) => {
    const selected = styles.find((item) => item.id === id)!;
    if (view === "xhs") setXhs(selected.xhs);
    else {
      setWechat(selected.wechat);
      setWechatCover(sceneWechatCover(id, wechatCover, selected.wechat));
    }
    onClose();
    toast.success(t("creator.templateApplied"), {
      action: {
        label: t("creator.templateUndo"),
        onClick: () => {
          if (view === "xhs") setXhs(xhs);
          else {
            setWechat(wechat);
            setWechatCover(wechatCover);
          }
        },
      },
    });
  };

  return (
    <div
      className="grid min-w-0 gap-3"
      data-testid="scene-gallery"
      aria-label={t("creator.sceneChoose")}
    >
      {styles.map((item) => (
        <div
          key={item.id}
          data-scene-preview={item.id}
          className="min-w-0 overflow-x-auto rounded-xl border border-border transition-colors hover:border-brand-primary focus-within:border-brand-primary"
        >
          <div
            className="relative flex min-w-full items-stretch"
            style={{ minWidth: "calc(var(--scene-card-height) * 3 + 184px)" }}
          >
            <p className="flex w-28 shrink-0 items-center border-r border-border px-4 py-3 text-base font-semibold">
              {t(item.title)}
            </p>
            {/* 分页测量使用 fixed 节点；限制绘制范围，避免 Firefox 将离屏节点计入弹框滚动高度。 */}
            <div
              aria-hidden="true"
              inert
              className="flex min-w-0 flex-1 items-center justify-center overflow-hidden [contain:paint]"
            >
              <div
                className="shrink-0"
                style={{ width: "calc(var(--scene-card-height) * 3 + 72px)" }}
              >
                {view === "xhs" ? (
                  <XhsPreview
                    previewOnly
                    thumbnail
                    html={previewHtml}
                    documentTitle={previewTitle}
                    hasTitle={Boolean(previewTitle)}
                    metadata={DEFAULT_XHS_METADATA}
                    style={{
                      ...item.xhs,
                      bodyTitleOverride: "",
                      cover: { ...item.xhs.cover, text: "", graphics: [] },
                    }}
                    keepHeadings={keepHeadings}
                    onPagesChange={noop}
                    onExport={noop}
                    onExportPage={noop}
                    exportDisabled
                    exporting={false}
                  />
                ) : (
                  <WechatArticlePreview
                    sections={sections.map(
                      (section) => renderWechat(section, item.wechat, profile).html,
                    )}
                    style={item.wechat}
                    cover={{
                      ...sceneWechatCover(item.id, wechatCover, item.wechat),
                      useDocumentTitle: true,
                      subtitle: "",
                    }}
                    title={previewTitle}
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={t(item.title)}
              onClick={() => apply(item.id)}
              className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
