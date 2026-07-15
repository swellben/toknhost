"use client";

import { useState, useTransition } from "react";
import { startCheckout } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Starts the card-upfront 7-day trial checkout. On success `startCheckout`
 * redirects to Stripe (the await never resolves); only an error comes back,
 * which we surface inline.
 */
export function UpgradeButton({
  label = "Start free trial",
  className,
  size = "sm",
}: {
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        className={cn("w-fit", className)}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const res = await startCheckout();
            if (res && "error" in res) setError(res.error);
          })
        }
      >
        {pending ? "Starting…" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
