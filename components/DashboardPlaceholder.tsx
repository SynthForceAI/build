"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function DashboardPlaceholder() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* Header */}
      <div className="border-b border-[#333333] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold">SynthForce</div>
          <Button variant="outline" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md mx-auto border-[#333333] bg-[#121212]">
          <CardHeader>
            <CardTitle className="text-center">🚀 We're Still Building</CardTitle>
            <CardDescription className="text-center">
              The dashboard is coming soon!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-[#A1A1AA]">
              In the meantime, check out our demo to see what's coming.
            </p>
            <Link href="/demo" className="block">
              <Button className="w-full">Go to Demo</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
