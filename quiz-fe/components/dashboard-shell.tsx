"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { cn } from "@/lib/utils";

const DashboardContext = createContext({ ready: false, markReady: () => {} });

export function DashboardShell({ admin, children }: { admin: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return <DashboardContext.Provider value={{ ready, markReady }}>
    <DashboardNav admin={admin} />
    <main id="page-content" tabIndex={-1} className="flex min-h-dvh flex-col px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8">
      {children}
    </main>
  </DashboardContext.Provider>;
}

export function DashboardContent({ compact, children }: { compact?: boolean; children: ReactNode }) {
  const { markReady } = useContext(DashboardContext);
  useEffect(markReady, [markReady]);
  return <div className={cn("mx-auto w-full", compact ? "max-w-5xl" : "max-w-6xl")}>{children}</div>;
}

export function DashboardLoading() {
  const { ready } = useContext(DashboardContext);
  return <LoadingScreen embedded={ready} />;
}
