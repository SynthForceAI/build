# Profile Section Audit

**Author:** Harini Dave  
**Date:** June 2026  
**Page:** `/U/profile`

---

## Current State

### Fields shown
| Field | Tab | Editable? |
|-------|-----|-----------|
| Display name | Account | Yes |
| Email | Account | No (read-only) |
| Account created date | Account | No |
| Company name | Workspace | No |
| Workspace ID | Workspace | No (copyable) |
| Role | Workspace | No |
| Connected API providers (name, key count, last used) | Providers | Via modal |
| Email digest frequency | Preferences | Yes |
| Currency | Preferences | No (USD only, locked) |

### Actions available
- Edit display name (inline save)
- Copy workspace ID to clipboard
- View and revoke API keys per provider (modal)
- Connect a new provider (links to `/U/onboard`)
- Change password (modal: current → new → confirm, verified via Supabase re-auth)
- Sign out this device
- Sign out all sessions (global Supabase sign-out)

---

## Competitive Analysis

### GitHub (`github.com/settings/profile`)
**Fields:** Username, name, bio, URL, company, location, pronouns, social accounts (up to 4 custom links), profile picture (upload/crop)  
**Actions:** Edit everything above, change password, configure 2FA (TOTP or SMS), manage SSH keys, manage personal access tokens, configure email addresses (primary + backup), notification settings, export account data, delete account  
**Unique features:** Pronouns field, multiple social links, profile README concept, granular notification routing per-repo

### Claude (`claude.ai` profile/settings)
**Fields:** Display name, email, profile picture  
**Actions:** Change email, change password, manage active sessions (shows device + last active), delete account  
**Unique features:** Session list with per-device sign-out, very minimal profile by design

### Stripe Dashboard (`dashboard.stripe.com/settings/user`)
**Fields:** Full name, email, phone, language, time zone  
**Actions:** Change password, enable 2FA (authenticator app), view and revoke active sessions, manage API keys (separate section), update notification preferences  
**Unique features:** Time zone selector affects all dashboard timestamps, 2FA is prominently encouraged, API key management is first-class

### Figma (`figma.com/settings`)
**Fields:** Full name, username, email, profile photo, bio  
**Actions:** Change password, configure 2FA, manage connected accounts (Google, GitHub SSO), notification preferences, delete account  
**Unique features:** Connected accounts (SSO providers), username as public identifier

---

## Gaps in SynthForce

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Avatar / profile photo | Missing | Medium | Gravatar fallback is a low-effort interim |
| Account deletion | Missing | High | GDPR/compliance requirement before growth; users expect it |
| Data export | Missing | High | Compliance; needed before onboarding enterprise orgs |
| 2FA (TOTP) | Missing | Medium | Important for security-conscious orgs connecting admin API keys |
| Active session list | Missing | Low | Nice to have; Claude has this — shows device + last seen |
| Bio / description | Missing | Low | Only relevant if SynthForce adds social/team profile features |
| Password change (confirm it works) | Exists | High | Modal is implemented — verify it works end-to-end in prod |
| Sign out all sessions | Exists | — | Already implemented in Security tab |
| Notification preferences | Partial | Medium | Email digest exists; no channel/topic granularity yet |
| Time zone | Missing | Low | Affects dashboard timestamps; add later when reporting is richer |
| Connected accounts (SSO) | Missing | Low | Only relevant if Google/GitHub login is added |

---

## Recommendations (Prioritized)

### High — Ship with Phase 1 or as a quick follow-on
1. **Account deletion** — A "Delete Account" button in the Security tab that triggers a confirmation dialog and calls a `/api/users/me` DELETE endpoint. Required before marketing to broader audiences.
2. **Data export** — A "Download my data" button that generates a JSON/CSV of the user's audit history and key metadata. Can be a stub that emails a download link.
3. **Verify password change works end-to-end** — The modal code is there; confirm it succeeds in the production Supabase project (not just local dev).

### Medium — Phase 1.5 / Early Phase 2
4. **Avatar upload** — Allow uploading a profile photo (store in Supabase Storage). Use Gravatar as an automatic fallback based on email hash. Surface the avatar in the dashboard header dropdown and sidebar.
5. **2FA (TOTP)** — Add an authenticator app option in the Security tab. Supabase supports TOTP natively via `supabase.auth.mfa`. Especially important given users are trusting SynthForce with admin API keys.
6. **Notification preference granularity** — Current email digest (daily/weekly/never) is a good start. Add: which events trigger emails (e.g., key revoked, spending threshold crossed).

### Low — Phase 2+
7. **Active session list** — Show a table of sessions (device, IP, last active) with per-row sign-out. Supabase exposes this via `auth.sessions`.
8. **Time zone** — Add a selector that controls how timestamps render across the dashboard.
9. **Connected accounts** — Only relevant if Google/GitHub OAuth login is added later.
