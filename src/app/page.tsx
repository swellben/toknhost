import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ToknHost — Design tokens your AI agent actually uses",
  description:
    "Design your Tailwind design system in a visual studio, then serve it to Claude, Cursor, and any MCP-aware agent over a live endpoint — so every component they generate uses your real tokens.",
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // Signed-in visitors go straight to the studio; everyone else signs in.
  const ctaHref = signedIn ? "/studio" : "/login";
  const ctaLabel = signedIn ? "Open studio" : "Start free";

  return (
    <main className="flex flex-col">
      <SiteHeader signedIn={signedIn} />
      <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <HowItWorks />
      <Features />
      <Pricing ctaHref={ctaHref} />
      <Faq />
      <FinalCta ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <SiteFooter />
    </main>
  );
}

/* ---------------- Header ---------------- */

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="text-sm font-semibold tracking-tight">Tokn.Host</span>
        </div>
        <nav className="flex items-center gap-2">
          <a
            href="#how"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Pricing
          </a>
          <Link
            href={signedIn ? "/studio" : "/login"}
            className={buttonVariants({ size: "sm" })}
          >
            {signedIn ? "Open studio" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(74,127,187,0.18), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Design tokens over MCP
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Design tokens your AI&nbsp;agent actually uses.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Build your Tailwind design system in a visual studio, then hand it to
            your AI coding agent over a live MCP endpoint. Claude, Cursor, and
            friends generate on-brand UI from your real tokens — instead of
            guessing your colors every prompt.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={ctaHref}
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}
            >
              {ctaLabel}
            </Link>
            <a
              href="#how"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-11 px-6"
              )}
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free to design one theme. No card until you connect an agent.
          </p>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

// A stylized mock of the MCP handoff — brand ramp on top, the tokens an agent
// receives below. Self-contained (no image asset); the colors are illustrative.
function HeroVisual() {
  const ramp = [
    "#eef2ff",
    "#e0e7ff",
    "#c7d2fe",
    "#a5b4fc",
    "#818cf8",
    "#6366f1",
    "#4f46e5",
    "#4338ca",
    "#3730a3",
    "#312e81",
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            brand / primary
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            tailwind-v4
          </span>
        </div>
        <div className="mt-3 grid grid-cols-10 overflow-hidden rounded-md">
          {ramp.map((c, i) => (
            <div key={c} className="h-8" style={{ backgroundColor: c }}>
              <span className="sr-only">{`primary-${i === 0 ? 50 : i * 100}`}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-border bg-background p-4 font-mono text-[12px] leading-relaxed">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            GET /design-system-mcp/acme
          </div>
          <pre className="overflow-x-auto text-foreground">
            <code>{`@theme {
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
}
:root {
  --primary: var(--color-brand-600);
  --radius: 0.625rem;
}`}</code>
          </pre>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Semantic tokens alias to primitives — your agent gets meaning, not a
          frozen hex.
        </p>
      </div>
    </div>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Design your theme",
      body: "Pick your brand colors, type, spacing, and radius. ToknHost generates a full, accessible Tailwind design system — primitives and semantic tokens, light and dark.",
    },
    {
      n: "2",
      title: "Get your MCP endpoint",
      body: "Every save publishes your tokens to a live MCP server (plus a plain fetch URL). One private endpoint, always in sync with your design.",
    },
    {
      n: "3",
      title: "Your agent builds on-brand",
      body: "Point Claude, Cursor, or any MCP client at it. They pull your tokens — shaped for your framework — and generate UI that matches your design system.",
    },
  ];
  return (
    <section id="how" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From a visual editor to your agent in three steps"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-border bg-card p-6"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-mono text-sm text-primary-foreground">
                {s.n}
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

function Features() {
  const features = [
    {
      title: "Tailwind-first",
      body: "Built around Tailwind v4 @theme. Also emits shadcn, Tailwind v3, CSS variables, and DTCG JSON — pick per request.",
    },
    {
      title: "Semantic, not flattened",
      body: "Semantic tokens alias to primitives (--primary: var(--color-brand-600)), so agents receive intent, not hardcoded hex.",
    },
    {
      title: "Light + dark, always",
      body: "Every token in both modes out of the box — no second pass, no drift between them.",
    },
    {
      title: "A real MCP server",
      body: "Not a download — a live endpoint your agent connects to, with a direct fetch URL for tools without MCP support.",
    },
    {
      title: "Designer-quality defaults",
      body: "Full 50–950 ramps, accessible foregrounds, sensible spacing and radius — generated to look hand-made.",
    },
    {
      title: "Private and yours",
      body: "Each endpoint is private by default behind a bearer token you can rotate anytime.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="What you get"
          title="One source of truth for design — human and agent"
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border p-6">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

function Pricing({ ctaHref }: { ctaHref: string }) {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when your agent needs it."
        />
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-border bg-card p-8">
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Design and explore one theme.
            </p>
            <p className="mt-6 text-4xl font-semibold tracking-tight">
              $0
              <span className="text-base font-normal text-muted-foreground">
                /mo
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              <Feat>One design system</Feat>
              <Feat>Full visual editor</Feat>
              <Feat>Light + dark, accessible defaults</Feat>
              <Feat muted>MCP endpoint &amp; export</Feat>
            </ul>
            <Link
              href={ctaHref}
              className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
            >
              Start free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-2xl border border-primary bg-card p-8">
            <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              7-day free trial
            </span>
            <h3 className="text-lg font-semibold">Pro</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Serve your tokens to your AI agents.
            </p>
            <p className="mt-6 text-4xl font-semibold tracking-tight">
              $12
              <span className="text-base font-normal text-muted-foreground">
                /mo
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              <Feat>Everything in Free</Feat>
              <Feat>Live MCP endpoint + fetch URL</Feat>
              <Feat>Export every framework format</Feat>
              <Feat>Unlimited design systems</Feat>
            </ul>
            <Link href={ctaHref} className={cn(buttonVariants(), "mt-8")}>
              Start 7-day free trial
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Card required · cancel anytime before day 7
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feat({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2 ${muted ? "text-muted-foreground" : ""}`}
    >
      <span className={muted ? "text-muted-foreground" : "text-success"}>
        {muted ? "—" : "✓"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ---------------- FAQ ---------------- */

function Faq() {
  const faqs = [
    {
      q: "What's MCP?",
      a: "The Model Context Protocol — the open standard AI coding agents like Claude and Cursor use to pull in external context and tools. ToknHost runs an MCP server that serves your design tokens.",
    },
    {
      q: "Do I need a card for the trial?",
      a: "Yes — the 7-day Pro trial takes a card upfront and converts to $12/mo after. Cancel anytime before day 7 from your billing portal and you won't be charged.",
    },
    {
      q: "Which frameworks are supported?",
      a: "Tailwind v4, shadcn, Tailwind v3, CSS variables, and DTCG JSON. Your agent asks for the format it wants, per request.",
    },
    {
      q: "Can I use it without MCP?",
      a: "Yes — every theme also has a plain fetchable URL that returns the same tokens, for tools and workflows that don't speak MCP yet.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10 divide-y divide-border">
          {faqs.map((f) => (
            <div key={f.q} className="py-5">
              <h3 className="font-medium">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Give your agent a design system it understands.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Design your tokens once. Keep every AI-generated component on-brand.
        </p>
        <Link
          href={ctaHref}
          className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 px-6")}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:px-6">
      <div className="flex items-center gap-2">
        <Logo className="size-5" />
        <span>© {new Date().getFullYear()} ToknHost</span>
      </div>
      <div className="flex items-center gap-5">
        <a href="#how" className="transition-colors hover:text-foreground">
          How it works
        </a>
        <a href="#pricing" className="transition-colors hover:text-foreground">
          Pricing
        </a>
        <Link href="/login" className="transition-colors hover:text-foreground">
          Sign in
        </Link>
      </div>
    </footer>
  );
}

/* ---------------- Shared ---------------- */

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-primary-hover">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
    </div>
  );
}
