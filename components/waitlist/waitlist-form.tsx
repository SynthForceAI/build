"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type WaitlistFormProps = {
  /** "page" renders a card-style form; "modal" is compact for dialogs. */
  variant?: "page" | "modal";
  /** Called after a successful signup (e.g. close a dialog). */
  onSuccess?: () => void;
  className?: string;
};

export function WaitlistForm({ variant = "page", onSuccess, className }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError("Please enter a valid work email");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          source: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          data.error?.message ??
          (data.error?.fields?.email?.[0]) ??
          "Something went wrong. Please try again.";
        setError(message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-4">
          <svg className="w-7 h-7 text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">You&apos;re on the list!</h3>
        <p className="text-gray-600">
          We&apos;ll reach out when early access opens. Check your inbox for updates.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        variant === "page" ? "bg-white p-8 md:p-10 space-y-5" : "space-y-4",
        className,
      )}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label htmlFor="waitlist-email" className="block text-sm font-medium text-gray-900">
          Work email <span className="text-red-500">*</span>
        </label>
        <Input
          id="waitlist-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="waitlist-name" className="block text-sm font-medium text-gray-900">
          Full name
        </label>
        <Input
          id="waitlist-name"
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="waitlist-company" className="block text-sm font-medium text-gray-900">
            Company
          </label>
          <Input
            id="waitlist-company"
            type="text"
            placeholder="Acme Inc."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={loading}
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="waitlist-role" className="block text-sm font-medium text-gray-900">
            Role
          </label>
          <Input
            id="waitlist-role"
            type="text"
            placeholder="Head of Engineering"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            autoComplete="organization-title"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full btn-primary font-sans font-semibold text-sm uppercase"
        disabled={loading}
      >
        {loading ? "Joining..." : "Join the Waitlist"}
      </Button>

      <p className="text-xs text-gray-500 text-center">No spam. Unsubscribe anytime.</p>
    </form>
  );
}
