import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { cn } from "@/lib/utils";

export function DashboardLayout({ admin, compact, children }: { admin?: boolean; compact?: boolean; children: ReactNode }) {
  return <>
    <DashboardNav admin={admin} />
    <main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8">
      <div className={cn("mx-auto", compact ? "max-w-5xl" : "max-w-6xl")}>{children}</div>
    </main>
  </>;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="ds-gradient-soft flex min-h-screen items-center justify-center px-5 py-10 sm:py-12">{children}</main>;
}

export function AssessmentLayout({ wide, centered, className, children }: { wide?: boolean; centered?: boolean; className?: string; children: ReactNode }) {
  return <main className={cn("quiz-student mx-auto px-4 py-8 sm:px-6 sm:py-12", wide ? "max-w-[1320px]" : "max-w-3xl", centered && "flex min-h-dvh flex-col justify-center", className)}>{children}</main>;
}
