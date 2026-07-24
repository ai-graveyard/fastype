"use client";

import QRCode from "qrcode";
import * as React from "react";

import type { XhsQrCodeStyle } from "@/lib/themes/xhs";

const QR_BASE_SIZE = 132;
export const XHS_QR_CODE_CONTENT_GAP = 20;

/**
 * 生成的二维码必须和「目标链接」输入框里看到的值完全一致，不做隐藏的默认值兜底——
 * 链接留空时宁可不显示二维码，也不能扫出一个输入框里看不到的地址。
 * 链接为空时自动回填默认地址的逻辑在设置面板里（失焦时），不在这里。
 */
export function hasRenderableXhsQrCode(qrCode: XhsQrCodeStyle): boolean {
  const normalizedUrl = qrCode.url.trim();
  return qrCode.enabled && Boolean(normalizedUrl) && normalizedUrl !== "https://";
}

export function xhsQrCodeHeight(qrCode: XhsQrCodeStyle): number {
  return QR_BASE_SIZE * qrCode.scale;
}

export function XhsQrCode({
  qrCode,
  style,
}: {
  qrCode: XhsQrCodeStyle;
  style?: React.CSSProperties;
}) {
  const [dataUrl, setDataUrl] = React.useState("");
  const normalizedUrl = qrCode.url.trim();
  const renderable = hasRenderableXhsQrCode(qrCode);

  React.useEffect(() => {
    let active = true;
    if (!renderable) {
      return () => {
        active = false;
      };
    }

    void QRCode.toDataURL(normalizedUrl, {
      width: Math.round(QR_BASE_SIZE * qrCode.scale),
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((next) => {
        if (active) setDataUrl(next);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [normalizedUrl, qrCode.scale, renderable]);

  if (!renderable) return null;

  const size = xhsQrCodeHeight(qrCode);

  return (
    <div
      className="ft-xhs-qr-code z-10 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10"
      data-position={qrCode.position}
      style={{
        width: size,
        height: size,
        alignSelf: qrCode.position.endsWith("left") ? "flex-start" : "flex-end",
        ...style,
      }}
      aria-label={normalizedUrl}
    >
      {dataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="" className="block size-full" />
        </>
      ) : null}
    </div>
  );
}
