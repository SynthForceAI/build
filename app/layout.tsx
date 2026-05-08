import type { Metadata } from "next";
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
      </body>
    </html>
  );
}

// TODO: Finish and add a universal navbar component to go here. I made original navbar component from legacy html. would just be better code structure
