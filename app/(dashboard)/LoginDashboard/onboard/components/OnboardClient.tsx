"use client";

import { useState } from "react";
import { ProviderForm } from "./ProviderForm";
import { RecentlyConnected } from "./RecentlyConnected";

type Provider = { id: string; name: string; displayName: string };
type Department = { id: string; name: string };
type Agent = {
  id:                  string;
  name:                string;
  providerName:        string;
  modelUsed:           string;
  status:              "pending" | "active" | "inactive";
  tasksMonitored:      number;
  totalCostCents:      number | string;
  connectedAt:         string;
  lastUsageReportedAt: string | null;
  department:          string | null;
};

type Props = {
  providers:     Provider[];
  departments:   Department[];
  initialAgents: Agent[];
};

export function OnboardClient({ providers, departments, initialAgents }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Onboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Connect provider API keys to bring agents into SynthForce.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <ProviderForm
            providers={providers}
            departments={departments}
            onSuccess={handleSuccess}
          />
        </div>
        <div className="lg:col-span-2">
          <RecentlyConnected
            initialAgents={initialAgents}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
