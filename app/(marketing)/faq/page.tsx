"use client";

import { SiteNav } from "@/components/ui/site-nav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SECTIONS = [
  {
    heading: "Security & Trust",
    prefix: "sec",
    items: [
      {
        q: "Is my API key safe?",
        a: "Yes. Your API key is encrypted with AES-256-GCM (military-grade encryption) the moment you paste it. We never store it in plain text. Only the encrypted version lives in our database.",
      },
      {
        q: "How do you encrypt my key?",
        a: "We use AES-256-GCM, an authenticated encryption algorithm. Your key is encrypted before it ever touches our database. Only your authenticated session can decrypt it. Even our engineers can't read it without your credentials.",
      },
      {
        q: "Can you see my API key?",
        a: "No. Not even SynthForce employees can decrypt your key. If you revoke it in your provider's console, we automatically detect that and stop using it.",
      },
      {
        q: "What if SynthForce gets hacked?",
        a: "Your API keys are encrypted with a key derived from your authentication token. If an attacker breaches our database, they get encrypted blobs they can't use without your session credentials.",
      },
      {
        q: "Can I revoke my key anytime?",
        a: "Yes. Go to Settings → Connected Keys → Revoke. We'll stop using it immediately. You can also revoke it in your provider's console (OpenAI, Anthropic, etc.) and we'll detect the revocation within minutes.",
      },
      {
        q: "Do you sell my data?",
        a: "No. We don't sell or share your usage data with anyone. We use it only to generate your audit report and show insights in your dashboard.",
      },
      {
        q: "Is the free audit private?",
        a: "Yes. Public audits (paste a key without signing up) create a temporary encrypted record. The audit ID is a random UUID — only someone with that ID can view the report. We delete the key after 7 days.",
      },
    ],
  },
  {
    heading: "How It Works",
    prefix: "how",
    items: [
      {
        q: "How does the free audit work?",
        a: "Paste your admin API key → we fetch your last 30 days of spending from your provider → we analyze it for inefficiencies → we generate a report with findings and recommendations → we show it to you immediately.",
      },
      {
        q: "What is an admin key?",
        a: 'An admin key is a special credential your provider issues that has access to billing and usage data. For OpenAI, it starts with sk-admin-. For Anthropic, sk-ant-admin-. It\'s required to read your spending history.',
      },
      {
        q: "Why do you need an admin key?",
        a: "Admin keys are the only way to access usage and billing data from your provider's API. Personal or workspace keys can only run inference, not read spending. We only use the admin key to read data (GET requests), never to modify anything.",
      },
    ],
  },
  {
    heading: "Billing & Data",
    prefix: "bill",
    items: [
      {
        q: "How often is my usage data updated?",
        a: "For the free audit: immediately (30-day backfill). For the paid platform: we sync every hour, with a 5–10 minute lag from the provider.",
      },
      {
        q: "Can I delete my account and all my data?",
        a: "Yes. Go to Settings → Account → Delete Account. We'll wipe your connected keys, audit history, and all associated data within 24 hours.",
      },
      {
        q: "What happens if I downgrade from paid to free?",
        a: "Your agent-level tracking stops. Your historical audit reports stay in your account. You can still run new free audits by connecting an admin key.",
      },
    ],
  },
  {
    heading: "Troubleshooting",
    prefix: "trouble",
    items: [
      {
        q: "I get 'Invalid API key' when I paste my key. What's wrong?",
        a: "Check: (1) You copied the full key with no extra spaces. (2) It's an admin key (starts with sk-admin- or sk-ant-admin-, not sk-... or sk-ant-api-). (3) The key hasn't been revoked in your provider's console.",
      },
      {
        q: "The audit report says 'No usage detected.' Why?",
        a: "This means your provider account hasn't made any API calls in the last 30 days. Either your agents aren't running, or you're using a different API key elsewhere.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <>
      <SiteNav />

      <main className="pt-16 pb-20 container mx-auto px-6">
        <div className="max-w-3xl mx-auto">

          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-600">
              Everything you need to know about SynthForce, API key security, and how the platform works.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            {SECTIONS.map((section) => (
              <div key={section.prefix}>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-accent mb-4">
                  {section.heading}
                </h2>
                <div className="bg-white border border-subtle rounded-2xl px-6">
                  <Accordion type="single" collapsible>
                    {section.items.map((item, i) => (
                      <AccordionItem
                        key={`${section.prefix}-${i + 1}`}
                        value={`${section.prefix}-${i + 1}`}
                      >
                        <AccordionTrigger className="text-left text-gray-900 font-medium">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-gray-600 leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  );
}
