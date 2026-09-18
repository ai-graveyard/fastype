"use client";

import * as React from "react";

import { usePrefs } from "@/components/providers/prefs-provider";
import { useStoredImages } from "@/hooks/use-image-library";
import { detectLocale } from "@/lib/i18n";
import { StorageKey } from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";
import {
  DEFAULT_USER_PROFILE,
  getDefaultUserProfile,
  parseUserProfile,
  type UserProfile,
} from "@/lib/user-profile";

const profileStore = createLocalStore(
  StorageKey.userProfile,
  parseUserProfile,
  DEFAULT_USER_PROFILE,
  () =>
    getDefaultUserProfile(
      typeof navigator === "undefined"
        ? "zh"
        : detectLocale(navigator.languages ?? [navigator.language]),
    ),
);

/** 头像图本体在 IndexedDB 里，这条记录里存的是引用。 */
const IMAGE_FIELDS = ["avatar"] as const;

interface UserProfileContextValue {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  resetProfile: () => void;
}

const UserProfileContext = React.createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { locale } = usePrefs();
  const stored = React.useSyncExternalStore(
    profileStore.subscribe,
    profileStore.getSnapshot,
    profileStore.getServerSnapshot,
  );
  // 对外给出的头像永远是能直接加载的地址：预览、导出 PNG、复制到公众号都靠它。
  const [profile, setProfile] = useStoredImages(stored, IMAGE_FIELDS, profileStore.set);

  const resetProfile = React.useCallback(() => {
    profileStore.set(getDefaultUserProfile(locale));
  }, [locale]);

  const value = React.useMemo<UserProfileContextValue>(
    () => ({
      profile,
      setProfile,
      resetProfile,
    }),
    [profile, setProfile, resetProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = React.useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside <UserProfileProvider>");
  return context;
}
