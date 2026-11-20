import type { TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg">
      <table
        className={cn(
          "w-full text-left text-sm [&>thead]:border-b [&>thead]:border-line [&>thead]:bg-surface-subtle [&>thead]:text-content-muted",
          "[&>thead>tr>th]:px-3 [&>thead>tr>th]:py-2.5 [&>thead>tr>th]:text-xs [&>thead>tr>th]:font-semibold",
          "[&>tbody>tr>td]:px-3 [&>tbody>tr>th]:px-3",
          className,
        )}
        {...props}
      />
    </div>
  );
}
