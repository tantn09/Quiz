import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="ds-gradient-soft flex min-h-screen items-center justify-center px-5 py-10 sm:py-12">{children}</main>;
}

export function AssessmentLayout({ wide, centered, className, children }: { wide?: boolean; centered?: boolean; className?: string; children: ReactNode }) {
  return <main className={cn("quiz-student mx-auto px-4 py-8 sm:px-6 sm:py-12", wide ? "max-w-[1320px]" : "max-w-3xl", centered && "flex min-h-dvh flex-col justify-center", className)}>{children}</main>;
}
