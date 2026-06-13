import { ConnectedProvidersList } from "./components/ConnectedProvidersList";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Account and company configuration.</p>

      <ConnectedProvidersList />
    </div>
  );
}
