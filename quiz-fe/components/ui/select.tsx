"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const EMPTY = "__quiz_select_empty__";
export type SelectOption = { value: string; label: string };

export function Select({ value, onValueChange, options, ariaLabel, className, disabled }: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return <SelectPrimitive.Root value={value === "" ? EMPTY : value} onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)} disabled={disabled}>
    <SelectPrimitive.Trigger aria-label={ariaLabel} className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface py-2.5 pl-4 pr-5 text-left text-sm text-content shadow-sm transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50", className)}>
      <SelectPrimitive.Value />
      <SelectPrimitive.Icon className="ml-3 flex shrink-0 items-center text-content-muted"><ChevronDown size={18} strokeWidth={2} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={6} align="start" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} className="z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-content shadow-xl">
        <SelectPrimitive.Viewport className="max-h-[19rem] overflow-y-auto">
          {options.map((option) => <SelectPrimitive.Item key={option.value} value={option.value === "" ? EMPTY : option.value} className="relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-sm outline-none transition-colors data-[highlighted]:bg-surface-accent data-[highlighted]:text-content data-[state=checked]:font-semibold data-[state=checked]:text-brand data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center"><Check size={16} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
