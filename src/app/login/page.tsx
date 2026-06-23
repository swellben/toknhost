"use client";

import { useActionState } from "react";
import { login, signup, type AuthActionResult } from "./actions";
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

  const message = loginState?.error ?? signupState?.error;

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
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          New here? Use Sign up, then confirm your email.
        </CardFooter>
      </Card>
    </div>
  );
}
