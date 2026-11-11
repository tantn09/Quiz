import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn("ds-field", className)} {...props} />);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn("ds-field", className)} {...props} />);
Textarea.displayName = "Textarea";
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) { return <label className={cn("block text-sm font-medium text-content", className)}><span>{label}</span>{children}{hint && <span className="mt-1 block text-xs text-content-muted">{hint}</span>}{error && <span role="alert" className="mt-1 block text-xs text-red-700">{error}</span>}</label>; }
