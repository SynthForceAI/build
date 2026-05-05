import type { Metadata } from "next";
import { inter } from "@/utils/fonts";
import "./globals.css";
import React from "react";

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
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
