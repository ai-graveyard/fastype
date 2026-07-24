"use client";

import * as React from "react";

import { StorageKey } from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";
import {
  DEFAULT_USER_PROFILE,
  parseUserProfile,
  type UserProfile,
} from "@/lib/user-profile";

const profileStore = createLocalStore(
  StorageKey.userProfile,
  parseUserProfile,
  DEFAULT_USER_PROFILE,
);

interface UserProfileContextValue {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  resetProfile: () => void;
}

const UserProfileContext = React.createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const profile = React.useSyncExternalStore(
    profileStore.subscribe,
    profileStore.getSnapshot,
    profileStore.getServerSnapshot,
  );

  const value = React.useMemo<UserProfileContextValue>(
    () => ({
      profile,
      setProfile: profileStore.set,
      resetProfile: profileStore.reset,
    }),
    [profile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = React.useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside <UserProfileProvider>");
  return context;
}

