"use client";

import * as React from "react";

import { DEFAULT_AI_CONFIG, isAiConfigured, parseAiConfig, type AiConfig } from "@/lib/ai/types";
import { StorageKey } from "@/lib/storage";
import { createLocalStore } from "@/lib/storage/store";

/** API Key 只落在这一条 localStorage 记录里，不进日志、URL 或埋点（PRD 10.2）。 */
const aiStore = createLocalStore(StorageKey.ai, parseAiConfig, DEFAULT_AI_CONFIG);

interface AiContextValue {
  config: AiConfig;
  configured: boolean;
  setConfig: (config: AiConfig) => void;
  clearConfig: () => void;
  /** AI 配置抽屉的开关，AI 面板在未配置时会引导到这里（PRD FT-AI-006）。 */
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const AiContext = React.createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: React.ReactNode }) {
  const config = React.useSyncExternalStore(
    aiStore.subscribe,
    aiStore.getSnapshot,
    aiStore.getServerSnapshot,
  );
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const value = React.useMemo<AiContextValue>(
    () => ({
      config,
      configured: isAiConfigured(config),
      setConfig: (next) => aiStore.set(next),
      clearConfig: () => aiStore.reset(),
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [config, settingsOpen],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  const context = React.useContext(AiContext);
  if (!context) throw new Error("useAi must be used inside <AiProvider>");
  return context;
}
