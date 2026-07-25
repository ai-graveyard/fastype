"use client";

import type { CSSProperties } from "react";

import {
  XHS_IDENTIFIER_BADGE_ICONS,
  type XhsIdentifierBadge,
} from "@/components/ui/identifier-badges";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { XhsIdentifierStyle } from "@/lib/themes/xhs";
import type { UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

const BASE_AVATAR_SIZE = 40;
const BASE_GAP = 12;
const BASE_NAME_SIZE = 18;
const BASE_META_SIZE = 14;
const BASE_LINE_GAP = 4;
/** 圆形头像相对文字块稍显下沉，向上做轻微光学校正。 */
const BASE_AVATAR_OPTICAL_OFFSET = 2;
export const XHS_IDENTIFIER_CONTENT_GAP = 20;

/** 昵称右侧的线性小徽章；设置面板的预览与实际导出共用这份逻辑。 */
export function XhsIdentifierBadgeGlyph({
  badge,
  color,
  size,
  strokeWidth,
  className,
}: {
  badge: XhsIdentifierBadge;
  color: string;
  size: number;
  /** 线条粗细，默认 2（lucide 图标的默认值）。 */
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = XHS_IDENTIFIER_BADGE_ICONS[badge];
  return (
    <Icon
      aria-hidden="true"
      data-testid="xhs-identifier-badge"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size, color }}
      fill="none"
      strokeWidth={strokeWidth}
    />
  );
}

export function formatIdentifierDate(date = new Date()): string {
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function xhsIdentifierHeight(identifier: XhsIdentifierStyle): number {
  const textHeight = identifier.showDate
    ? BASE_NAME_SIZE + BASE_LINE_GAP + BASE_META_SIZE
    : BASE_NAME_SIZE;
  return Math.max(BASE_AVATAR_SIZE, textHeight) * identifier.scale;
}

export function XhsIdentifier({
  identifier,
  profile,
  color,
  accentColor,
  unitScale = 1,
  className,
  style,
}: {
  identifier: XhsIdentifierStyle;
  profile: UserProfile;
  color: string;
  /** 徽章未自定义颜色时的默认色；留空则沿用 color（昵称颜色）。 */
  accentColor?: string;
  /** 设置页示意图使用更小的单位缩放；导出卡片保持 1。 */
  unitScale?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (!identifier.enabled) return null;

  const scale = identifier.scale * unitScale;
  const avatarSize = BASE_AVATAR_SIZE * scale;
  const rowHeight = xhsIdentifierHeight(identifier) * unitScale;
  const alignRight = identifier.position.endsWith("right");
  const meta = [identifier.showDate ? formatIdentifierDate() : "", profile.slogan]
    .filter(Boolean)
    .join("  ");

  return (
    <div
      className={cn("ft-xhs-identifier flex w-full shrink-0 items-center", className)}
      data-position={identifier.position}
      style={{
        height: rowHeight,
        justifyContent: alignRight ? "flex-end" : "flex-start",
        ...style,
      }}
    >
      <div className="flex min-w-0 max-w-full items-center" style={{ gap: BASE_GAP * scale }}>
        <UserAvatar
          src={profile.avatar}
          name={profile.name}
          className={cn(
            "ft-xhs-identifier-avatar",
            identifier.avatarBorder ? "ring-1 ring-gray-300" : "ring-0",
          )}
          style={{
            width: avatarSize,
            height: avatarSize,
            transform: `translateY(${-BASE_AVATAR_OPTICAL_OFFSET * scale}px)`,
          }}
        />
        <div
          className="ft-xhs-identifier-text flex min-w-0 flex-col justify-center"
          style={{ height: avatarSize, color }}
        >
          <p
            className="m-0 flex min-w-0 items-center font-medium"
            style={{
              marginTop: 0,
              marginRight: 0,
              marginBottom: 0,
              marginLeft: 0,
              textIndent: 0,
              /** 固定行高：放大徽章时只在这一行内向上下溢出，不撑高整行、不挤压下方签名。 */
              height: BASE_NAME_SIZE * scale,
              fontSize: BASE_NAME_SIZE * scale,
              lineHeight: 1,
            }}
          >
            <span className="truncate">{profile.name}</span>
            {identifier.badgeEnabled ? (
              <XhsIdentifierBadgeGlyph
                badge={identifier.badge}
                color={identifier.badgeColor || accentColor || color}
                size={BASE_NAME_SIZE * scale * identifier.badgeScale}
                strokeWidth={identifier.badgeStrokeWidth}
                className="ml-[0.25em]"
              />
            ) : null}
          </p>
          {meta ? (
            <p
              className="m-0 truncate opacity-55"
              style={{
                marginTop: BASE_LINE_GAP * scale,
                marginRight: 0,
                marginBottom: 0,
                marginLeft: 0,
                textIndent: 0,
                fontSize: BASE_META_SIZE * scale,
                lineHeight: 1,
              }}
            >
              {meta}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
