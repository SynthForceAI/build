"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
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

export function ProfileClient({ data }: { data: ProfileData }) {
  const router = useRouter();

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

  // ── Password modal ───────────────────────────────────────
  const [passwordOpen, setPasswordOpen] = useState(false);

  const sectionTitle = `${theme.fontSize.lg} ${theme.font.classBold} ${theme.color.textPrimary}`;
  const sectionLabel = `${theme.fontSize.sm} ${theme.font.classMedium} ${theme.color.textBody}`;
  const card = `${theme.component.cardMain} ${theme.spacing.p6}`;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8">
        <h1 className={`${theme.fontSize["2xl"]} font-bold ${theme.color.textPrimary}`}>Profile</h1>
        <p className={`${theme.fontSize.sm} ${theme.color.textSubtle} mt-1`}>
          Account, workspace, and personal preferences.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">

        {/* ── Account ─────────────────────────────────── */}
        <section className={card}>
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
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  className={`flex-1 px-4 py-2 border ${theme.color.borderInput} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent`}
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
                <p className="text-xs text-red-500 mt-1">Name must be 2–50 characters.</p>
              )}
              {nameMsg && (
                <p className={`text-xs mt-1 ${nameMsg.ok ? "text-green-600" : "text-red-500"}`}>
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
          </div>
        </section>

        {/* ── Workspace ───────────────────────────────── */}
        <section className={card}>
          <h2 className={`${sectionTitle} mb-1`}>Workspace</h2>
          <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
            The company and role tied to your account.
          </p>

          <div className="space-y-4">
            <div>
              <label className={`${sectionLabel} block mb-1`}>Company</label>
              <p className={`${theme.fontSize.sm} ${theme.color.textPrimary}`}>
                {data.company.name || <span className={theme.color.textDisabled}>—</span>}
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

        {/* ── Connected Providers ─────────────────────── */}
        <section className={card}>
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
                          ? `Connected · ${fmtLastUsed(p.lastUsedAt)}`
                          : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/LoginDashboard/onboard"
                    className={`text-xs ${theme.font.classMedium} text-[#00B2FF] hover:underline`}
                  >
                    {p.connected ? "Manage Keys" : "Connect"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Preferences ─────────────────────────────── */}
        <section className={card}>
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

        {/* ── Security ────────────────────────────────── */}
        <section className={card}>
          <h2 className={`${sectionTitle} mb-1`}>Security</h2>
          <p className={`${theme.fontSize.xs} ${theme.color.textSubtle} mb-5`}>
            Update the password used to sign in to SynthForce.
          </p>

          <button
            onClick={() => setPasswordOpen(true)}
            className={`px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition`}
          >
            Update Password
          </button>
        </section>
      </div>

      {passwordOpen && (
        <PasswordModal
          email={data.user.email}
          onClose={() => setPasswordOpen(false)}
        />
      )}
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

    // Step 1 — verify the old password by attempting a sign-in. Supabase
    // does not natively check the current password on updateUser, so we
    // do it explicitly. Success refreshes the session in place.
    const verify = await supabase.auth.signInWithPassword({ email, password: oldPwd });
    if (verify.error) {
      setError("Current password is incorrect.");
      setSaving(false);
      return;
    }

    // Step 2 — set the new password on the now-verified session.
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
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-10"
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
              <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
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
              {newPwd.length > 0 && !distinct && (
                <p className="text-xs text-red-500 mt-1">New password must differ from current.</p>
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
