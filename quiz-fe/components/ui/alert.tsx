import * as React from "react";
import { cn } from "@/lib/utils";
export function Alert({ tone = "info", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: "info" | "error" | "success" }) { const tones = { info: "ds-info", error: "ds-error", success: "ds-success" }; return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border border-line p-4 text-sm", tones[tone], className)} {...props} />; }
