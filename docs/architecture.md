# SynthForce Platform — Architecture & Database Design v1.0

## Overview

SynthForce is a management platform for AI agents ("HR for AI agents"). Companies onboard their agents, set budgets and policies in plain English, track costs in real time, and enforce guardrails across providers (OpenAI, Anthropic, Gemini, etc.).

---

## 1. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | TypeScript + React (migrating from HTML) | Hosted on Vercel |
| **Backend** | Node.js / Express | API server deployed on Vercel (serverless) or separate VPS |
| **Database** | PostgreSQL | Supabase (free tier to start) or AWS RDS / Neon.tech |
| **Auth** | Supabase Auth or Clerk | Handles user accounts + API key management |
| **ORM** | Prisma or Drizzle | Prisma recommended for schema management + migrations |
| **Hosting** | Vercel (frontend + API serverless functions) | Domain: synthforceai.com |

---

## 2. Database Schema (PostgreSQL)

### 2.1 Entity Relationship Overview

```
Companies 1---* Users
Companies 1---* Departments
Departments 1---* Agents
Companies 1---* Policies
Users 1---* Agents (managed_by)
Agents *---1 Providers
Agents 1---* UsageLogs
Agents *---* Policies (enforced_on) via PolicyAssignments
```

### 2.2 Tables

#### companies
The top-level tenant. Each customer gets one.

```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'team', 'enterprise'
    is_active BOOLEAN DEFAULT TRUE
);
```

#### users
People who log into the dashboard. Can belong to one company.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(company_id, email)
);
```

#### departments
Organizational structure within a company.

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- 'Engineering', 'Sales', 'Finance', 'Customer Support'
    description TEXT,
    monthly_budget_cents BIGINT DEFAULT 0, -- budget in cents ($1 = 100)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, name)
);
```

#### providers
AI model providers. Pre-seeded by SynthForce.

```sql
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- 'OpenAI', 'Anthropic', 'Gemini', 'Cohere', etc.
    display_name VARCHAR(255) NOT NULL,
    api_base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO providers (name, display_name) VALUES
    ('openai', 'OpenAI'),
    ('anthropic', 'Anthropic'),
    ('google-gemini', 'Google Gemini'),
    ('cohere', 'Cohere'),
    ('meta-llama', 'Meta Llama'),
    ('mistral', 'Mistral AI');
```

#### provider_models
Specific models offered by each provider.

```sql
CREATE TABLE provider_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL, -- 'gpt-4', 'gpt-4o', 'claude-3-opus', 'claude-3-sonnet', 'gemini-1.5-pro'
    display_name VARCHAR(255) NOT NULL,
    input_price_per_token NUMERIC(20, 10) NOT NULL DEFAULT 0, -- per token pricing
    output_price_per_token NUMERIC(20, 10) NOT NULL DEFAULT 0,
    context_window INT DEFAULT 128000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider_id, model_id)
);
```

#### agents
The core entity. Each AI agent being managed.

```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'deactivated', 'flagged'
    provider_id UUID REFERENCES providers(id),
    model_id UUID REFERENCES provider_models(id),
    api_key_identifier VARCHAR(100), -- reference to stored API key (not the key itself)
    monthly_budget_cents BIGINT DEFAULT 50000, -- default $500 budget
    current_month_spend_cents BIGINT DEFAULT 0,
    total_lifetime_spend_cents BIGINT DEFAULT 0,
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    managed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- responsible human
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- Index for fast queries
CREATE INDEX idx_agents_company ON agents(company_id);
CREATE INDEX idx_agents_department ON agents(department_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_provider ON agents(provider_id);
```

#### usage_logs
Every API call made by an agent. This is the most frequently written-to table.

```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id),
    model_id UUID REFERENCES provider_models(id),
    prompt_text TEXT,
    response_text TEXT,
    tokens_in INT NOT NULL DEFAULT 0,
    tokens_out INT NOT NULL DEFAULT 0,
    cost_cents NUMERIC(20, 6) NOT NULL DEFAULT 0, -- cost in cents, high precision
    duration_ms INT, -- how long the API call took
    endpoint VARCHAR(255), -- '/v1/chat/completions', etc.
    status_code INT, -- HTTP response status
    was_blocked BOOLEAN DEFAULT FALSE, -- true if a policy blocked this request
    policy_id UUID REFERENCES policies(id), -- which policy blocked it, if any
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical indexes for performance
CREATE INDEX idx_usage_company ON usage_logs(company_id);
CREATE INDEX idx_usage_agent ON usage_logs(agent_id);
CREATE INDEX idx_usage_created ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_cost ON usage_logs(company_id, created_at DESC);
-- Partition or cleanup strategy: archive logs older than 90 days
```

#### policies
Guardrails written in plain English. Rules that agents must follow.

```sql
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_definition JSONB NOT NULL, -- structured rule (see Policy Engine section)
    severity VARCHAR(50) NOT NULL DEFAULT 'warning', -- 'warning', 'block', 'flag', 'log'
    scope VARCHAR(50) NOT NULL DEFAULT 'global', -- 'global', 'department', 'agent'
    scope_department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE INDEX idx_policies_company ON policies(company_id);
```

#### policy_assignments
Many-to-many: which policies apply to which agents.

```sql
CREATE TABLE policy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(policy_id, agent_id)
);
```

#### budget_alerts
Records of budget threshold notifications.

```sql
CREATE TABLE budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'budget_80pct', 'budget_100pct', 'budget_exceeded', 'anomaly'
    threshold_cents BIGINT NOT NULL,
    current_spend_cents BIGINT NOT NULL,
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### api_keys
Stored provider API keys per company. Never expose the raw key in responses.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id),
    label VARCHAR(255), -- 'Production OpenAI key', 'Staging Anthropic key'
    encrypted_key TEXT NOT NULL, -- encrypted at rest
    key_identifier VARCHAR(100), -- last 4 chars for reference
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, provider_id, label)
);
```

---

## 3. Supabase Setup (Recommended)

### 3.1 Why Supabase

- Free tier: 500MB database, 50,000 monthly active users, 2GB bandwidth
- Built-in auth (magic link, Google, GitHub)
- Auto-generates REST API from your schema
- Provides a local dev environment via `supabase CLI`

### 3.2 Setup Steps

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize in project
cd synthforce-platform
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push

# Start local dev
supabase start
```

### 3.3 Alternative: Neon.tech

- Generous free tier (1GB database)
- Serverless PostgreSQL with branching
- Good for development

---

## 4. Authentication Flow

### 4.1 User Auth (Supabase Auth)

```
User signs up → Email/password or magic link
       ↓
Supabase Auth creates user record
       ↓
API creates corresponding row in `users` table with company_id
       ↓
JWT token returned to frontend
```

### 4.2 Agent Auth (API Proxy)

When an agent makes an API call, it goes through SynthForce:

```
Agent → SynthForce API → Provider API
           ↓
    Log request, check policies,
    deduct from budget
```

The agent authenticates to SynthForce using a generated API key stored in the `agents` table.

---

## 5. API Endpoints (Express/Next.js API Routes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Login |
| GET | /api/agents | List agents for company |
| POST | /api/agents | Create new agent |
| GET | /api/agents/:id | Get agent details |
| PATCH | /api/agents/:id | Update agent |
| POST | /api/agents/:id/pause | Pause agent |
| POST | /api/agents/:id/activate | Activate agent |
| GET | /api/agents/:id/usage | Get usage log for agent |
| GET | /api/departments | List departments |
| POST | /api/departments | Create department |
| GET | /api/policies | List policies |
| POST | /api/policies | Create policy |
| POST | /api/proxy/chat | Proxy request to provider |
| GET | /api/usage/summary | Dashboard summary |
| GET | /api/usage/analytics | Cost analytics |

---

## 6. Policy Engine Design

The policy engine evaluates each agent request before it reaches the provider.

### Policy Rule Format (JSON)

```json
{
  "type": "budget",
  "operator": "less_than",
  "field": "monthly_spend",
  "value": 50000,
  "action": "block"
}
```

### Policy Types

| Type | Description | Example |
|------|-------------|---------|
| `budget` | Enforce budget limits | "Block if monthly spend exceeds $500" |
| `rate_limit` | Limit request frequency | "Max 100 requests per minute" |
| `time_restriction` | Restrict by time | "Only allow during business hours" |
| `content_guard` | Block certain content | "Block requests involving competitor names" |
| `model_restriction` | Limit model access | "Only allow GPT-4, not GPT-4o" |
| `department_isolation` | Keep agents in their department | "Sales agent cannot access engineering data" |

### Evaluation Flow

```
Incoming request → Authenticate agent
                    ↓
         Load agent + company + policies
                    ↓
         Check each active policy against request
                    ↓
         If any policy blocks → Return 403 + log violation
                    ↓
         If all pass → Forward to provider
                    ↓
         Log usage, update budget counters
```

---

## 7. Directory Structure (Backend)

```
synthforce-platform/
├── src/
│   ├── pages/          # Frontend pages (migrating to React)
│   ├── assets/         # Images, logos
│   ├── components/     # React components
│   ├── styles/         # CSS/Tailwind
│   └── api/            # Backend API (Vercel serverless functions)
│       ├── auth/
│       ├── agents/
│       ├── departments/
│       ├── policies/
│       ├── usage/
│       └── proxy/
├── prisma/
│   └── schema.prisma   # Database schema (Prisma ORM)
├── docs/               # Architecture docs (this file)
├── scripts/            # Build/deploy scripts
├── .env.example
├── package.json
└── vercel.json
```

---

## 8. Migration Plan

### Phase 1 — Foundation (Current Sprint)
- [ ] Set up PostgreSQL (Supabase)
- [ ] Create schema (tables above)
- [ ] Set up Prisma ORM
- [ ] User auth (Supabase Auth or Clerk)
- [ ] Basic API: create company, invite users
- [ ] Connect frontend demo to real data

### Phase 2 — Agent Management
- [ ] CRUD for agents
- [ ] CRUD for departments
- [ ] Provider integration (OpenAI API proxy)
- [ ] Usage logging

### Phase 3 — Policy Engine
- [ ] CRUD for policies
- [ ] Policy evaluation middleware
- [ ] Budget tracking and alerts

### Phase 4 — Analytics & Dashboard
- [ ] Cost dashboards
- [ ] Usage reports
- [ ] Anomaly detection
- [ ] Email notifications for alerts

---

## 9. Environment Variables

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
JWT_SECRET=...
NEXT_PUBLIC_APP_URL=https://synthforceai.com
```
