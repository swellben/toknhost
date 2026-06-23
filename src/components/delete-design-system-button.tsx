"use client";

import { deleteDesignSystem } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function DeleteDesignSystemButton({ designSystemId }: { designSystemId: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Delete this design system and all its tokens? This can't be undone.")) {
          deleteDesignSystem(designSystemId);
        }
      }}
    >
      Delete
    </Button>
  );
}
