"use client";

import * as React from "react";
import { Toaster } from "sonner";

import { AiProvider } from "@/components/providers/ai-provider";
import { DocumentProvider } from "@/components/providers/document-provider";
import { PrefsProvider, usePrefs } from "@/components/providers/prefs-provider";
import { StyleProvider } from "@/components/providers/style-provider";
import { LangApplier, ThemeApplier } from "@/components/providers/theme-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrefsProvider>
      <ThemeApplier />
      <LangApplier />
      <StyleProvider>
        <UserProfileProvider>
          <AiProvider>
            <DocumentProvider>
              <TooltipProvider delayDuration={300}>
                {children}
                <AppToaster />
              </TooltipProvider>
            </DocumentProvider>
          </AiProvider>
        </UserProfileProvider>
      </StyleProvider>
    </PrefsProvider>
  );
}

function AppToaster() {
  const { themeMode } = usePrefs();
  return (
    <Toaster position="top-right" theme={themeMode} closeButton toastOptions={{ duration: 4000 }} />
  );
}
