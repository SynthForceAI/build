# Supabase local config

This folder holds **auth email templates** for SynthForce. Database migrations live in `prisma/`; Supabase Auth is used for identity only.

## Email templates

| File | Supabase template key | When sent |
|------|----------------------|-----------|
| `templates/confirm-signup.html` | `auth.email.template.confirmation` | After signup, before first login |

## Setup

1. Run `supabase init` if `config.toml` does not exist yet.
2. Merge `config.email-templates.toml` into `config.toml`.
3. Paste `templates/confirm-signup.html` into the Supabase dashboard (**Authentication → Email templates → Confirm signup**) for hosted projects.

See [docs/supabase-email-verification.md](../docs/supabase-email-verification.md) for full dashboard steps.
