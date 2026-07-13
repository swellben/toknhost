"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { login, signup, type AuthActionResult } from "./actions";
import {
  OAUTH_PROVIDERS,
  signInWithProvider,
  type OAuthProvider,
} from "@/lib/supabase/oauth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const initialState: AuthActionResult = undefined;

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState
  );

  const [oauthError, setOauthError] = useState<string>();
  const [oauthPending, startOAuth] = useTransition();
  const [activeProvider, setActiveProvider] = useState<OAuthProvider>();

  function handleOAuth(provider: OAuthProvider) {
    setOauthError(undefined);
    setActiveProvider(provider);
    startOAuth(async () => {
      const { error } = await signInWithProvider(provider);
      if (error) {
        setOauthError(error);
        setActiveProvider(undefined);
      }
      // On success the browser is redirected to the provider, so no cleanup here.
    });
  }

  const isLogin = mode === "login";
  const state = isLogin ? loginState : signupState;
  const pending = isLogin ? loginPending : signupPending;
  const error = oauthError ?? (state && "error" in state ? state.error : undefined);
  const notice = state && "notice" in state ? state.notice : undefined;

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 py-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo className="size-10" />
            <div>
              <h1 className="text-lg font-semibold">ToknHost</h1>
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Log in to your account" : "Create your account"}
              </p>
            </div>
          </div>

          {/* Email / password form */}
          <form
            key={mode}
            className="flex w-full flex-col gap-4"
            action={isLogin ? loginAction : signupAction}
          >
            <div className="grid gap-2 text-center">
              <Label htmlFor="email" className="justify-center">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-2 text-center">
              <Label htmlFor="password" className="justify-center">
                {isLogin ? "Password" : "Create a password"}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={isLogin ? undefined : 6}
                required
              />
            </div>
            {!isLogin && (
              <div className="grid gap-2 text-center">
                <Label htmlFor="confirmPassword" className="justify-center">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
            )}

            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            {notice && (
              <p className="text-center text-sm text-muted-foreground">{notice}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? isLogin
                  ? "Logging in…"
                  : "Creating account…"
                : isLogin
                  ? "Log in"
                  : "Create account"}
            </Button>
          </form>

          {/* Mode toggle */}
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "New to ToknHost? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              onClick={() => {
                setOauthError(undefined);
                setMode(isLogin ? "signup" : "login");
              }}
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>

          {/* Divider */}
          <div className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">Or continue with</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* OAuth providers — stacked, full width */}
          <div className="flex w-full flex-col gap-2">
            {OAUTH_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={() => handleOAuth(provider.id)}
                disabled={oauthPending}
              >
                {PROVIDER_ICONS[provider.id]}
                {oauthPending && activeProvider === provider.id
                  ? "Redirecting…"
                  : `Continue with ${provider.label}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Brand icons ---------- */

const PROVIDER_ICONS: Record<OAuthProvider, ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58C20.56 22.29 24 17.79 24 12.5 24 5.87 18.63.5 12 .5z" />
    </svg>
  ),
  figma: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#0ACF83" d="M8 24c2.21 0 4-1.79 4-4v-4H8a4 4 0 100 8z" />
      <path fill="#A259FF" d="M4 12a4 4 0 014-4h4v8H8a4 4 0 01-4-4z" />
      <path fill="#F24E1E" d="M4 4a4 4 0 014-4h4v8H8a4 4 0 01-4-4z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 010 8h-4V0z" />
      <path fill="#1ABCFE" d="M20 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
};
