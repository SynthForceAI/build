import type { Metadata } from "next";
import Script from "next/script";
import { inter } from "@/lib/fonts";
import "./globals.css";
import React from "react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/ui/footer";


export const metadata: Metadata = {
  title: "SynthForce | HR for AI Agents - Manage Your Synthetic Workforce",
  description:
    "SynthForce is the HR platform for AI agents. " +
      "Onboard, measure, and govern your synthetic workforce.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(inter.variable, inter.className)}>
      <body>
        {children}
        <Footer />
        <Script src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

// TODO: Each page could export its own metadata. Work on that for better SEO in the future.
// TODO: Init migration is complete. 1:1 of legacy site is done. Now we can focus on refining the repo, clear any redundancies, mistakes, etc.
// TODO: Start working on backend and schema. May have a meeting about this.
