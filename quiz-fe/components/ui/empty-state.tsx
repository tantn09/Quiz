import * as React from "react";
import { cn } from "@/lib/utils";
export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: React.ReactNode; className?: string }) { return <div className={cn("rounded-xl border border-dashed border-line bg-surface-subtle px-5 py-10 text-center", className)}><p className="font-semibold text-content">{title}</p>{description && <p className="mt-2 text-sm text-content-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>; }
