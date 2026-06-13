import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { SpendingDashboard } from "./components/SpendingDashboard";

export default async function SpendingPage() {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return <SpendingDashboard />;
}
