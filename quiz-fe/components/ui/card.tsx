import * as React from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) { return <section className={cn("ds-card p-5 sm:p-6", className)} {...props} />; }
