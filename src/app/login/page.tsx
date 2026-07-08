"use client";

import { useActionState, useState, useTransition } from "react";
import { login, signup, type AuthActionResult } from "./actions";
import {
  OAUTH_PROVIDERS,
  signInWithProvider,
  type OAuthProvider,
} from "@/lib/supabase/oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: AuthActionResult = undefined;

export default function LoginPage() {
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

  const message = oauthError ?? loginState?.error ?? signupState?.error;

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ToknHost</CardTitle>
          <CardDescription>
            Sign in to manage your design tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" action={loginAction}>
            <input
              type="hidden"
              name="origin"
              value={
                typeof window !== "undefined" ? window.location.origin : ""
              }
            />
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {message && (
              <p className="text-sm text-destructive">{message}</p>
            )}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loginPending}>
                {loginPending ? "Signing in…" : "Log in"}
              </Button>
              <Button
                type="submit"
                variant="outline"
                formAction={signupAction}
                disabled={signupPending}
              >
                {signupPending ? "Signing up…" : "Sign up"}
              </Button>
            </div>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              Or continue with
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OAUTH_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                onClick={() => handleOAuth(provider.id)}
                disabled={oauthPending}
              >
                {oauthPending && activeProvider === provider.id
                  ? "Redirecting…"
                  : provider.label}
              </Button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          New here? Use Sign up, then confirm your email.
        </CardFooter>
      </Card>
    </div>
  );
}
