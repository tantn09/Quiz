import * as React from "react";
import { cn } from "@/lib/utils";
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) { return <div className="w-full overflow-x-auto"><table className={cn("w-full text-left text-sm", className)} {...props} /></div>; }
