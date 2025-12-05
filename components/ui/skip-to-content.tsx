import * as React from "react";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

/**
 * SkipToContent component for keyboard navigation
 * Allows keyboard users to skip navigation and go directly to main content
 */
export function SkipToContent() {
  return (
    <Button
      asChild
      variant="outline"
      className="absolute left-0 top-0 -translate-y-full focus:translate-y-0 z-50 transition-transform"
    >
      <a href="#main-content">
        Skip to main content
      </a>
    </Button>
  );
}
