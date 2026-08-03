"use client";

import * as React from "react";

import { usePrefs } from "@/components/providers/prefs-provider";
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

interface UserProfileContextValue {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  resetProfile: () => void;
}

const UserProfileContext = React.createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { locale } = usePrefs();
  const profile = React.useSyncExternalStore(
    profileStore.subscribe,
    profileStore.getSnapshot,
    profileStore.getServerSnapshot,
  );

  const resetProfile = React.useCallback(() => {
    profileStore.set(getDefaultUserProfile(locale));
  }, [locale]);

  const value = React.useMemo<UserProfileContextValue>(
    () => ({
      profile,
      setProfile: profileStore.set,
      resetProfile,
    }),
    [profile, resetProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = React.useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside <UserProfileProvider>");
  return context;
}
