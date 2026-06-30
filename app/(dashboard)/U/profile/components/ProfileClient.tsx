"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, LogOut, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { theme } from "@/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@prisma/client";

export type ProfileData = {
  user: {
    id:        string;
    name:      string;
    email:     string;
    role:      UserRole;
    createdAt: string; // ISO
  };
  company: {
    id:   string;
    name: string;
    slug: string;
  };
  preferences: {
    emailDigest: "daily" | "weekly" | "never";
    currency:    string;
  };
  providers: Array<{
    id:          string;
    name:        string;
    displayName: string;
    connected:   boolean;
    keysCount:   number;
    lastUsedAt:  string | null; // ISO
    keys:        Array<{
      id:            string;
      keyIdentifier: string | null;
      label:         string | null;
      createdAt:     string; // ISO
    }>;
  }>;
};

const ROLE_PILL: Record<UserRole, string> = {
  owner:  "bg-purple-100 text-purple-800",
  admin:  "bg-blue-100 text-blue-800",
  member: "bg-gray-100 text-gray-700",
  viewer: "bg-gray-100 text-gray-500",
};

function fmtJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtLastUsed(iso: string | null): string {
  if (!iso) return "never used";
  return `last used ${new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  })}`;
}

type Tab = "account" | "workspace" | "providers" | "preferences" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "account",     label: "Account"     },
  { id: "workspace",   label: "Workspace"   },
  { id: "providers",   label: "Providers"   },
  { id: "preferences", label: "Preferences" },
  { id: "security",    label: "Security"    },
];

export function ProfileClient({ data }: { data: ProfileData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // ── Account ──────────────────────────────────────────────
  const [name, setName] = useState(data.user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameDirty   = name.trim() !== data.user.name;
  const nameValid   = name.trim().length >= 2 && name.trim().length <= 50;
  const canSaveName = nameDirty && nameValid && !savingName;

  async function saveName() {
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/users/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      setNameMsg({ ok: true, text: "Display name saved." });
      router.refresh();
    } catch {
      setNameMsg({ ok: false, text: "Couldn't save your name. Please try again." });
    } finally {
      setSavingName(false);
    }
  }

  // ── Workspace ────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  async function copyWorkspaceId() {
    try {
      await navigator.clipboard.writeText(data.company.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (insecure context / older browser). Silent.
    }
  }

  // ── Preferences ──────────────────────────────────────────
  const [emailDigest, setEmailDigest] = useState(data.preferences.emailDigest);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveEmailDigest(next: "daily" | "weekly" | "never") {
    const prev = emailDigest;
    setEmailDigest(next);
    setSavingPrefs(true);
    setPrefsMsg(null);
    try {
      const res = await fetch("/api/users/me/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emailDigest: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setPrefsMsg({ ok: true, text: "Preferences saved." });
    } catch {
      setEmailDigest(prev); // revert on failure
      setPrefsMsg({ ok: false, text: "Couldn't save preference. Please try again." });
    } finally {
      setSavingPrefs(false);
    }
  }

  // ── Manage Keys modal ────────────────────────────────────
  type ProviderWithKeys = ProfileData["providers"][number];
  const [manageProvider, setManageProvider] = useState<ProviderWithKeys | null>(null);
  const [providerKeys, setProviderKeys]     = useState<ProfileData["providers"][number]["keys"]>([]);
  const [revoking, setRevoking]             = useState<string | null>(null);

  function openManageKeys(p: ProviderWithKeys) {
    setManageProvider(p);
    setProviderKeys(p.keys);
  }

  async function revokeKey(keyId: string) {
    if (!confirm("Revoke this key? This removes it from the database and disconnects any agents using it.")) return;
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/api-keys/${keyId}/revoke`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to revoke key. Please try again.");
        return;
      }
      setProviderKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success("Key revoked and removed.");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRevoking(null);
    }
  }

  // ── Logout ───────────────────────────────────────────────
  const [loggingOut, setLoggingOut]       = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);


  async function handleDeleteAccount() {
    setDeleting(true);
    try{
      const res = await fetch("/api/users/me", { method: "DELETE" })
      if (!res.ok) throw new Error();
      router.push("/")
    } catch {
      toast.error("Couldn't delete account. Please try again.")
      setDeleting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/login");
    } catch {
      toast.error("Logout failed . Please try again.");
      setLoggingOut(false);
    }
  }

  async function handleLogoutAll() {
    setLoggingOutAll(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out of all sessions");
      router.push("/login");
    } catch {
      toast.error("Couldn't sign out all sessions . Please try again.");
      setLoggingOutAll(false);
    }
  }

  // ── Password modal ───────────────────────────────────────
  const [passwordOpen, setPasswordOpen] = useState(false);

  const sectionTitle = `${theme.fontSize.lg} ${theme.font.classBold} ${theme.color.textPrimary}`;
  const sectionLabel = `${theme.fontSize.sm} ${theme.font.classMedium} ${theme.color.textBody}`;
  const card = `${theme.component.cardMain} ${theme.spacing.p6}`;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-6">
        <h1 className={`${theme.fontSize["2xl"]} font-bold ${theme.color.textPrimary}`}>Profile</h1>
        <p className={`${theme.fontSize.sm} ${theme.color.textSubtle} mt-1`}>
          Account, workspace, and personal preferences.
        </p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto" role="tablist" aria-label="Profile sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`tabpanel-${id}`}
            onClick={() => setActiveTab(id)}
            className={[
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-[#00B2FF] text-[#00B2FF]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ──────────────────────────────────── */}
      <div className="max-w-3xl mx-auto">

        {/* Account */}
        {activeTab === "account" && (
          <section id="tabpanel-account" role="tabpanel" aria-labelledby="tab-account" className={`${card} animate-fade-in`}>
            <h2 className={`${sectionTitle} mb-1`}>Account</h2>
            <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
              Identifying information for your SynthForce login.
            </p>

            <div className="space-y-4">
              <div>
                <label className={`${sectionLabel} block mb-1`}>Display name</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setNameMsg(null); }}
                    maxLength={50}
                    className={`flex-1 px-4 py-2 border ${theme.color.borderInput} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent`}
                    aria-describedby={nameMsg ? "name-msg" : undefined}
                  />
                  <button
                    onClick={saveName}
                    disabled={!canSaveName}
                    className={`px-4 py-2 ${theme.component.buttonPrimary} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#00B2FF] disabled:hover:text-white`}
                  >
                    {savingName ? "Saving…" : "Save"}
                  </button>
                </div>
                {nameDirty && !nameValid && (
                  <p id="name-msg" className="text-xs text-red-500 mt-1">Name must be 2–50 characters.</p>
                )}
                {nameMsg && (
                  <p id="name-msg" className={`text-xs mt-1 ${nameMsg.ok ? "text-green-600" : "text-red-500"}`}>
                    {nameMsg.text}
                  </p>
                )}
              </div>

              <div>
                <label className={`${sectionLabel} block mb-1`}>
                  Email <span className={`${theme.color.textDisabled} font-normal`}>(cannot change)</span>
                </label>
                <p className={`${theme.fontSize.sm} ${theme.color.textMuted} px-4 py-2 bg-gray-50 rounded-lg border ${theme.color.border}`}>
                  {data.user.email}
                </p>
              </div>

              <div>
                <label className={`${sectionLabel} block mb-1`}>Account created</label>
                <p className={`${theme.fontSize.sm} ${theme.color.textSubtle}`}>
                  Joined {fmtJoined(data.user.createdAt)}
                </p>
              </div>
              <div>
                <label className={`${sectionLabel} block mb-1`}>Your data</label>
                <a
                  href="/api/users/me/export"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Download my data
                </a>
                <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mt-1`}>
                  Downloads a JSON file with your profile, preferences, and audit history.
                </p>
              </div>

            </div>
          </section>
        )}

        {/* Workspace */}
        {activeTab === "workspace" && (
          <section id="tabpanel-workspace" role="tabpanel" aria-labelledby="tab-workspace" className={`${card} animate-fade-in`}>
            <h2 className={`${sectionTitle} mb-1`}>Workspace</h2>
            <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
              The company and role tied to your account.
            </p>

            <div className="space-y-4">
              <div>
                <label className={`${sectionLabel} block mb-1`}>Company</label>
                <p className={`${theme.fontSize.sm} ${theme.color.textPrimary}`}>
                  {data.company.name || <span className={theme.color.textDisabled}>-</span>}
                </p>
              </div>

              <div>
                <label className={`${sectionLabel} block mb-1`}>Workspace ID</label>
                <div className="flex items-center gap-2">
                  <code className={`flex-1 px-3 py-2 ${theme.font.classMono} text-xs ${theme.color.textMuted} bg-gray-50 rounded-lg border ${theme.color.border} truncate`}>
                    {data.company.id}
                  </code>
                  <button
                    onClick={copyWorkspaceId}
                    className={`px-3 py-2 border ${theme.color.borderInput} rounded-lg text-xs ${theme.color.textBody} hover:bg-gray-50 transition flex items-center gap-1.5`}
                    aria-label="Copy workspace ID"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <label className={`${sectionLabel} block mb-1`}>Role</label>
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ROLE_PILL[data.user.role]}`}>
                  {data.user.role}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Providers */}
        {activeTab === "providers" && (
          <section id="tabpanel-providers" role="tabpanel" aria-labelledby="tab-providers" className={`${card} animate-fade-in`}>
            <h2 className={`${sectionTitle} mb-1`}>API Providers</h2>
            <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
              Manage your connected agent providers.
            </p>

            {data.providers.length === 0 ? (
              <p className={`${theme.fontSize.sm} ${theme.color.textSubtle}`}>
                No providers configured yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.providers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          p.connected ? theme.status.active.dot : "bg-gray-300"
                        }`}
                      />
                      <div>
                        <p className={`${theme.fontSize.sm} ${theme.font.classMedium} ${theme.color.textPrimary}`}>
                          {p.displayName}
                        </p>
                        <p className={`${theme.fontSize.xs} ${theme.color.textSubtle}`}>
                          {p.connected
                            ? `${p.keysCount} key${p.keysCount === 1 ? "" : "s"} · ${fmtLastUsed(p.lastUsedAt)}`
                            : "Not connected"}
                        </p>
                      </div>
                    </div>
                    {p.connected ? (
                      <button
                        onClick={() => openManageKeys(p)}
                        className={`text-xs ${theme.font.classMedium} text-[#00B2FF] hover:underline`}
                      >
                        Manage keys
                      </button>
                    ) : (
                      <Link
                        href="/U/onboard"
                        className={`text-xs ${theme.font.classMedium} text-[#00B2FF] hover:underline`}
                      >
                        Connect
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Preferences */}
        {activeTab === "preferences" && (
          <section id="tabpanel-preferences" role="tabpanel" aria-labelledby="tab-preferences" className={`${card} animate-fade-in`}>
            <h2 className={`${sectionTitle} mb-1`}>Preferences</h2>
            <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
              Personal display and notification settings.
            </p>

            <div className="space-y-4">
              <div>
                <label className={`${sectionLabel} block mb-1`}>Currency</label>
                <select
                  value="USD"
                  disabled
                  className={`w-full px-4 py-2 border ${theme.color.borderInput} rounded-lg text-sm bg-gray-50 ${theme.color.textSubtle} cursor-not-allowed`}
                >
                  <option>USD (Coming soon: EUR, GBP)</option>
                </select>
              </div>

              <div>
                <label className={`${sectionLabel} block mb-1`}>Email digest</label>
                <select
                  value={emailDigest}
                  onChange={(e) => saveEmailDigest(e.target.value as "daily" | "weekly" | "never")}
                  disabled={savingPrefs}
                  className={`w-full px-4 py-2 border ${theme.color.borderInput} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent disabled:opacity-60`}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="never">Never</option>
                </select>
                {prefsMsg && (
                  <p className={`text-xs mt-1 ${prefsMsg.ok ? "text-green-600" : "text-red-500"}`}>
                    {prefsMsg.text}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Security */}
        {activeTab === "security" && (
          <div className="space-y-4 animate-fade-in">
            <section id="tabpanel-security" role="tabpanel" aria-labelledby="tab-security" className={card}>
              <h2 className={`${sectionTitle} mb-1`}>Password</h2>
              <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
                Update the password used to sign in to SynthForce.
              </p>

              <button
                onClick={() => setPasswordOpen(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Update Password
              </button>
            </section>

            <section className={card}>
              <h2 className={`${sectionTitle} mb-1`}>Sessions</h2>
              <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
                Manage where you&rsquo;re signed in.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  {loggingOut ? "Signing out…" : "Sign out this device"}
                </button>

                <button
                  onClick={handleLogoutAll}
                  disabled={loggingOutAll}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition disabled:opacity-40"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  {loggingOutAll ? "Signing out everywhere…" : "Sign out of all sessions"}
                </button>
              </div>
            </section>

            <section className={`${card} border-red-100`}>
              <h2 className={`${sectionTitle} mb-1 text-red-600`}>Danger Zone</h2>
              <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition"
              >
                Delete Account
              </button>
            </section>
          </div>
        )}
      </div>

      {passwordOpen && (
        <PasswordModal
          email={data.user.email}
          onClose={() => setPasswordOpen(false)}
        />
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteOpen(false)} />
          <div role="dialog" aria-label="Delete account" className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete your account?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete your account, preferences, and disconnect all API keys. Company data and agents are not affected. <strong>This cannot be undone.</strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageProvider && (
        <ManageKeysModal
          provider={manageProvider}
          keys={providerKeys}
          revoking={revoking}
          onRevoke={revokeKey}
          onClose={() => setManageProvider(null)}
        />
      )}
    </div>
  );
}

// ── Manage Keys Modal ──────────────────────────────────────────────────────

type KeyRow = ProfileData["providers"][number]["keys"][number];

function ManageKeysModal({
  provider,
  keys,
  revoking,
  onRevoke,
  onClose,
}: {
  provider:  ProfileData["providers"][number];
  keys:      KeyRow[];
  revoking:  string | null;
  onRevoke:  (id: string) => Promise<void>;
  onClose:   () => void;
}) {
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Manage keys for ${provider.displayName}`}
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{provider.displayName} keys</h2>
            <p className="text-xs text-gray-500 mt-0.5">Revoking a key removes it from the database and disconnects any agents using it.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="py-8 text-center">
            <KeyRound className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No active keys for this provider.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 mb-5">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {k.label ?? "Unnamed key"}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {k.keyIdentifier ? `…${k.keyIdentifier}` : "no fingerprint"} · Added {fmtDate(k.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRevoke(k.id)}
                  disabled={revoking === k.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50 shrink-0"
                >
                  {revoking === k.id ? (
                    <>
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Revoking…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" />
                      Revoke
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <Link
            href="/U/onboard"
            className="text-sm font-medium text-[#00B2FF] hover:underline"
            onClick={onClose}
          >
            + Add new key
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Password Change Modal ───────────────────────────────────────────────────

function PasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [oldPwd,      setOldPwd]      = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  const newPwdValid = newPwd.length >= 8;
  const matches     = newPwd === confirmPwd;
  const distinct    = newPwd !== oldPwd;
  const canSubmit   = oldPwd.length > 0 && newPwdValid && matches && distinct && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    // Step 1 - verify the old password by attempting a sign-in. Supabase
    // does not natively check the current password on updateUser, so we
    // do it explicitly. Success refreshes the session in place.
    const verify = await supabase.auth.signInWithPassword({ email, password: oldPwd });
    if (verify.error) {
      setError("Current password is incorrect.");
      setSaving(false);
      return;
    }

    // Step 2 - set the new password on the now-verified session.
    const update = await supabase.auth.updateUser({ password: newPwd });
    if (update.error) {
      setError(update.error.message || "Couldn't update password.");
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
  }

  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Update password"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Update password</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">Password updated</p>
            <p className="text-xs text-gray-500 mb-5">
              Your new password will be required at your next sign-in.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-[#00B2FF]/90 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className={inputClass}
              />
              {newPwd.length > 0 && !newPwdValid && (
                <p className="text-xs text-red-500 mt-1">At least 8 characters required.</p>
              )}
              {newPwd.length > 0 && newPwdValid && !distinct && (
                <p className="text-xs text-red-500 mt-1">New password must differ from current.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className={inputClass}
              />
              {confirmPwd.length > 0 && !matches && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Updating…" : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
