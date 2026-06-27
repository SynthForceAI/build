"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ResendVerificationFormProps = {
  email: string;
  onEmailChange?: (email: string) => void;
};

export function ResendVerificationForm({ email, onEmailChange }: ResendVerificationFormProps) {
  const [value, setValue] = useState(email);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not send verification email.");
        setLoading(false);
        return;
      }

      setMessage("If an account exists for that address, a new verification email is on its way.");
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label htmlFor="verify-email" className="block text-sm font-medium">
          Email
        </label>
        <Input
          id="verify-email"
          type="email"
          placeholder="you@example.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onEmailChange?.(e.target.value);
          }}
          disabled={loading}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Resend verification email"}
      </Button>
    </form>
  );
}

type VerifyEmailCardProps = {
  email?: string;
  errorCode?: string;
};

export function VerifyEmailCard({ email = "", errorCode }: VerifyEmailCardProps) {
  const errorMessage =
    errorCode === "confirmation_failed"
      ? "That verification link is invalid or has expired. Request a new email below."
      : errorCode === "missing_token"
        ? "That verification link is incomplete. Request a new email below."
        : null;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to your inbox. Click it to activate your SynthForce account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          Didn&apos;t get the email? Check spam, or resend the verification link below.
        </p>

        <ResendVerificationForm email={email} />

        <div className="text-center text-sm">
          Already verified?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
