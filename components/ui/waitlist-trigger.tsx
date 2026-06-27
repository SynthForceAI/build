"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

type WaitlistTriggerProps = Omit<ComponentProps<"button">, "type"> & {
  children: ReactNode;
};

export function WaitlistTrigger({ children, className, ...props }: WaitlistTriggerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className} {...props}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Join the Waitlist</DialogTitle>
          <DialogDescription>
            Early access, a free agent-audit report, and 6 months free for your first 5 agents.
          </DialogDescription>
        </DialogHeader>
        <WaitlistForm variant="modal" />
        <p className="text-center text-sm text-gray-500 pt-2">
          Prefer the full page?{" "}
          <Link href="/waitlistsignup" className="text-accent hover:underline">
            Open waitlist form
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
