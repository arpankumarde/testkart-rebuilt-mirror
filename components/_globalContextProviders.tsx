// Global context providers for the entire application
// Note: This file exports a named export GlobalContextProviders (no default export)
import { ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./Tooltip";
import { SonnerToaster } from "./SonnerToaster";
import { ScrollToTop } from "./ScrollToTop";
import { AuthProvider } from "../helpers/useAuth";
import { reportAuthFailure } from "../helpers/sessionSync";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { AutoRenewalChecker } from "./AutoRenewalChecker";
import { ScriptInjector } from "./ScriptInjector";
import { BookDemoPopup } from "./BookDemoPopup";
import { BookDemoDialogProvider } from "../helpers/useBookDemoDialog";
import { restoreThemeMode } from "../helpers/themeMode";

// Module scope so the saved theme lands before the first client render on every route.
restoreThemeMode();

// A "not authenticated" failure on any query or mutation makes AuthProvider recheck the session.
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportAuthFailure }),
  mutationCache: new MutationCache({ onError: reportAuthFailure }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ScrollToTop />
      <AuthProvider>
        <ImpersonationBanner />
        <AutoRenewalChecker />
        <ScriptInjector />
        <TooltipProvider>
          {/* Wraps children so BookDemoButtons inside pages share the one dialog. */}
          <BookDemoDialogProvider>
            {children}
            <BookDemoPopup />
          </BookDemoDialogProvider>
          <SonnerToaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
