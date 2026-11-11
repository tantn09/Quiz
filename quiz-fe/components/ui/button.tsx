import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "ds-gradient text-white hover:brightness-110",
      outline: "border border-line bg-surface text-content hover:bg-surface-subtle",
      destructive: "bg-red-700 text-white hover:bg-red-800",
      ghost: "text-content hover:bg-surface-subtle",
    },
    size: { default: "px-4 py-2", sm: "rounded-lg px-3", lg: "min-h-12 px-5", icon: "w-11" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
