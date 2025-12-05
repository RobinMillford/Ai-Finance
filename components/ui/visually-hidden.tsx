import * as React from "react";
import { cn } from "@/lib/utils";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

/**
 * VisuallyHidden component for screen reader only content
 * Hides content visually but keeps it accessible to screen readers
 */
export function VisuallyHidden({ children, className, ...props }: VisuallyHiddenProps) {
  return (
    <span
      className={cn("sr-only", className)}
      {...props}
    >
      {children}
    </span>
  );
}
