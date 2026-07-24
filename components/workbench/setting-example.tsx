"use client";

import * as React from "react";

import { renderWechat } from "@/lib/render/wechat";
import { XHS_CARD_CLASS, xhsCardCss } from "@/lib/render/xhs";
import type { WechatStyle } from "@/lib/themes/wechat";
import type { XhsStyle } from "@/lib/themes/xhs";
import type { UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

const subscribeToClient = () => () => {};

export function SettingExample({
  label,
  children,
  className,
  contentClassName,
  testId,
}: React.PropsWithChildren<{
  label: string;
  className?: string;
  contentClassName?: string;
  testId?: string;
}>) {
  return (
    <div
      className={cn("rounded-xl border border-dashed bg-muted/20 p-3", className)}
      data-setting-example={testId ?? ""}
    >
      <div className="mb-2 text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={cn("space-y-2", contentClassName)}>{children}</div>
    </div>
  );
}

function previewXhsStyle(style: XhsStyle): XhsStyle {
  const scale = 0.45;
  return {
    ...style,
    fontSize: Math.max(12, Math.round(style.fontSize * scale)),
    letterSpacing: Math.round(style.letterSpacing * scale * 10) / 10,
    padding: Math.max(8, Math.round(style.padding * 0.2)),
    pageNumberScale: Math.max(0.75, style.pageNumberScale * 0.55),
    elements: {
      ...style.elements,
      listIndent: Math.max(16, Math.round(style.elements.listIndent * scale)),
      listSpacing: Math.round(style.elements.listSpacing * scale),
      quoteBorderWidth: Math.max(
        style.elements.quoteBorderWidth > 0 ? 1 : 0,
        Math.round(style.elements.quoteBorderWidth * scale),
      ),
      quoteRadius: Math.round(style.elements.quoteRadius * scale),
      quotePadding: Math.max(6, Math.round(style.elements.quotePadding * scale)),
      codeFontSize: Math.max(11, Math.round(style.elements.codeFontSize * scale)),
      codeRadius: Math.round(style.elements.codeRadius * scale),
    },
  };
}

export function XhsSettingExample({
  label,
  style,
  children,
  className,
  testId,
  showPaddingGuide,
}: React.PropsWithChildren<{
  label: string;
  style: XhsStyle;
  className?: string;
  testId?: string;
  showPaddingGuide?: boolean;
}>) {
  const reactId = React.useId();
  const exampleId = React.useMemo(() => reactId.replace(/[^a-z0-9_-]/gi, ""), [reactId]);
  const previewStyle = React.useMemo(() => previewXhsStyle(style), [style]);
  const scopedSelector = `.${XHS_CARD_CLASS}[data-xhs-example="${exampleId}"]`;
  const scopedCss = React.useMemo(
    () => xhsCardCss(previewStyle).split(`.${XHS_CARD_CLASS}`).join(scopedSelector),
    [previewStyle, scopedSelector],
  );

  return (
    <SettingExample label={label} className={className} testId={testId}>
      <style>{scopedCss}</style>
      <div
        className={cn(
          XHS_CARD_CLASS,
          "relative box-border max-h-72 overflow-hidden rounded-xl border shadow-sm",
        )}
        data-xhs-example={exampleId}
        style={{ padding: previewStyle.padding }}
      >
        {showPaddingGuide ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-brand-primary/35 bg-brand-primary/8"
              style={{ height: previewStyle.padding }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-brand-primary/35 bg-brand-primary/8"
              style={{ height: previewStyle.padding }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 border-r border-dashed border-brand-primary/35 bg-brand-primary/8"
              style={{ width: previewStyle.padding }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 border-l border-dashed border-brand-primary/35 bg-brand-primary/8"
              style={{ width: previewStyle.padding }}
            />
          </>
        ) : null}
        {children}
      </div>
    </SettingExample>
  );
}

export function WechatSettingExample({
  label,
  html,
  style,
  profile,
  className,
  testId,
}: {
  label: string;
  html: string;
  style: WechatStyle;
  profile?: UserProfile;
  className?: string;
  testId?: string;
}) {
  const isClient = React.useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  const renderedHtml = React.useMemo(
    () => (isClient ? renderWechat(html, style, profile).html : ""),
    [html, isClient, profile, style],
  );

  return (
    <SettingExample label={label} className={className} testId={testId}>
      <div
        className="max-h-80 overflow-hidden rounded-xl border bg-background shadow-sm"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </SettingExample>
  );
}
