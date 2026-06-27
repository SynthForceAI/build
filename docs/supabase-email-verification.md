# Supabase email verification setup

SynthForce requires verified email before account access. The app handles confirmation at `/auth/callback`; signup sets `emailRedirectTo` to `{NEXT_PUBLIC_APP_URL}/auth/callback`.

## Dashboard configuration (production)

### 1. Enable confirm email

**Authentication → Providers → Email**

- Enable **Confirm email**

### 2. URL configuration

**Authentication → URL configuration**

| Setting | Value |
|---------|-------|
| **Site URL** | `https://synthforceai.com` |
| **Redirect URLs** | `https://synthforceai.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |

Redirect URLs must exactly match `NEXT_PUBLIC_APP_URL/auth/callback` for each environment.

### 3. Confirm signup email template

**Authentication → Email templates → Confirm signup**

**Subject:**

```
Verify your SynthForce email
```

**Body:** paste the contents of [`supabase/templates/confirm-signup.html`](../supabase/templates/confirm-signup.html).

The template uses `{{ .ConfirmationURL }}`. Supabase builds a verify link that includes the `redirect_to` from signup (`/auth/callback`). After the user clicks **Verify Email**:

1. Supabase validates the token
2. Browser redirects to `/auth/callback?code=...` (PKCE)
3. `app/auth/callback/route.ts` exchanges the code for a session
4. SynthForce provisions the company + user rows
5. User is redirected to `/U`

### Alternative link (direct server verification)

If `{{ .ConfirmationURL }}` does not redirect correctly, replace the button `href` with:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">
```

Our callback route also supports `token_hash` + `type` via `verifyOtp`.

## Local development

```bash
brew install supabase/tap/supabase
supabase init   # if not already initialized
```

Merge [`supabase/config.email-templates.toml`](../supabase/config.email-templates.toml) into `supabase/config.toml`, then:

```bash
supabase start
```

Local Inbucket UI (default): `http://localhost:54324` — view test confirmation emails.

Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`.

## SMTP (production delivery)

Supabase’s built-in email is rate-limited. For production, configure custom SMTP under **Authentication → SMTP settings** (SendGrid, Resend, Postmark, etc.).

## Checklist

- [ ] Confirm email enabled
- [ ] Site URL and redirect URLs configured
- [ ] Confirm signup template pasted from `supabase/templates/confirm-signup.html`
- [ ] `NEXT_PUBLIC_APP_URL` matches Site URL per environment
- [ ] Custom SMTP configured for production (recommended)
