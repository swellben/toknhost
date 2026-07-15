"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { logout } from "@/app/login/actions";
import { openBillingPortal } from "@/app/billing/actions";

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({
  email,
  showManageBilling = false,
}: {
  email: string;
  /** Show "Manage billing" — only for users who've been through checkout. */
  showManageBilling?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [portalPending, startPortal] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-accent"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initialsOf(email)}
        </span>
        <span className="hidden max-w-32 truncate text-sm sm:inline">{email}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border bg-popover p-1 shadow-md">
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Settings
          </Link>
          {showManageBilling && (
            <button
              type="button"
              disabled={portalPending}
              onClick={() => startPortal(async () => void (await openBillingPortal()))}
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {portalPending ? "Opening…" : "Manage billing"}
            </button>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
