import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" }) { const tones = { neutral: "ds-info", success: "ds-success", warning: "ds-warning", danger: "ds-error" }; return <span className={cn("ds-pill", tones[tone], className)} {...props} />; }
