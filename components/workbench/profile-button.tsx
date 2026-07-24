"use client";

import * as React from "react";

import { usePrefs } from "@/components/providers/prefs-provider";
import { useUserProfile } from "@/components/providers/user-profile-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface ProfileButtonProps {
  onClick?: () => void;
}

/** 统一跳转到「设置 → 用户资料」的头像入口，不在局部重复维护编辑表单。 */
export function ProfileButton({ onClick }: ProfileButtonProps) {
  const { t } = usePrefs();
  const { profile } = useUserProfile();

  return (
    <button
      type="button"
      className="rounded-full transition-transform hover:scale-105 active:scale-95"
      aria-label={t("profile.openEditor")}
      title={`${profile.name} · ${profile.slogan}`}
      onClick={onClick}
    >
      <UserAvatar src={profile.avatar} name={profile.name} className="size-8 shadow-sm" />
    </button>
  );
}

interface ProfileCardProps {
  onClick?: () => void;
  /** 头像右侧的补充说明，例如「点击编辑」或「与顶部人设同步」。 */
  hint?: string;
  className?: string;
}

/** 整行可点的资料卡：头像、昵称、签名任意位置点击都能进入编辑，不必精确点中头像。 */
export function ProfileCard({ onClick, hint, className }: ProfileCardProps) {
  const { t } = usePrefs();
  const { profile } = useUserProfile();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("profile.openEditor")}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-brand-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
        className,
      )}
    >
      <UserAvatar
        src={profile.avatar}
        name={profile.name}
        className="size-8 shrink-0 shadow-sm transition-transform group-hover:scale-105"
      />
      <span className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{profile.name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile.slogan}</p>
      </span>
      {hint ? (
        <span className="max-w-28 shrink-0 text-right text-xs leading-5 text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
