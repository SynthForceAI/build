"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SECTIONS = [
  {
    heading: "Getting Started",
    prefix: "start",
    items: [
      {
        q: "What is SynthForce?",
        a: "Paste your OpenAI/Anthropic API key, see exactly where your $$ went in the last 30 days, get intelligent insights to cut costs. That's it. Free.",
      },
      {
        q: "Do I need to sign up?",
        a: "Yeah, quick free account. Then you're done setup.",
      },
      {
        q: "Which providers do you support?",
        a: "OpenAI and Anthropic right now. Google Gemini, AWS Bedrock, and Azure coming soon.",
      },
      {
        q: "How do I find my API key and do I need a full admin key?",
        a: "OpenAI: Organization Settings → Billing → API Keys. Anthropic: Account Settings → API Keys. You need billing access to read usage data. But if your provider supports read-only keys, use that instead—we only read data, never write or modify anything. A read-only key is safer because we literally can't do anything harmful with it.",
      },
      {
        q: "Can I connect multiple provider keys?",
        a: "Yes. One dashboard, multiple provider keys (OpenAI + Anthropic together), unified view.",
      },
      {
        q: "Is this free?",
        a: "The free audit is one-time only (1 audit). If you want to re-run audits, keep history, and track over time, the Starter plan is $49/mo. Team ($199/mo) adds budgets, departments, and policies. Enterprise is custom for real-time proxy layer.",
      },
    ],
  },
  {
    heading: "What You'll See",
    prefix: "see",
    items: [
      {
        q: "What's in the audit and how is it different from my provider's billing page?",
        a: "Your provider shows raw numbers. We show intelligence. You get: an efficiency score (52/100 = room to improve), role inference (what each model is doing based on token patterns—Analyst, Writer, Researcher), cost spikes flagged with context, benchmarking (how your cache rate compares to industry average), specific savings recommendations (\"Switch GPT-4 → GPT-4o-mini, save $X/month\"), burn rate forecast, and a written analysis. All in English, all your providers in one place. Your provider can't do any of that.",
      },
      {
        q: "Is it real-time?",
        a: "No, there's a 5–10 min lag from the provider. This is a historical audit, not live monitoring.",
      },
      {
        q: "Can I see cost per agent or per feature?",
        a: "Not yet. Phase 1 shows organization-level intelligence only. Per-agent tracking and attribution come in paid tiers (Phase 2).",
      },
      {
        q: "How fast is it?",
        a: "~30 seconds from paste to report.",
      },
      {
        q: "Can I share my report?",
        a: "Yes, you get a shareable link. Anyone with the link can view your findings.",
      },
    ],
  },
  {
    heading: "Security",
    prefix: "sec",
    items: [
      {
        q: "Is my key safe and can you access it?",
        a: "Yes, encrypted with AES-256-GCM (military-grade) instantly. We never see it in plain text. Not even our team can decrypt it without your login. If you get hacked, an attacker gets an encrypted blob—useless without your session. For extra safety, give us a read-only key (even safer—we literally can't do anything with it), or rotate your key after the audit.",
      },
      {
        q: "Do you sell my data or keep it forever?",
        a: "Nope. We don't sell usage data or contact info. Your audit reports stay in your account indefinitely. Your encrypted key stays until you revoke it. You can delete your entire account anytime (Settings → Account → Delete), and we wipe everything within 24 hours.",
      },
      {
        q: "Will this audit affect my production?",
        a: "No. Reads 30 days of historical data via read-only API calls. Doesn't send traffic through SynthForce or modify anything in your account.",
      },
    ],
  },
  {
    heading: "Troubleshooting",
    prefix: "trouble",
    items: [
      {
        q: '"Invalid API key" error?',
        a: "Check: (1) You copied the full key with no extra spaces. (2) It's actually a billing/admin or read-only key (not a regular API key). (3) Not revoked in your provider's console. (4) Your billing is active.",
      },
      {
        q: 'Report says "No usage detected"?',
        a: "You haven't made API calls in the last 30 days, or you're using a different key in production. Try again after you run a few calls.",
      },
      {
        q: "Can I audit multiple orgs or run audits frequently?",
        a: "Yep, create separate accounts or add multiple keys to one account. Run audits as often as you want—no rate limit on the free audit. For unlimited re-runs and history, upgrade to Starter.",
      },
    ],
  },
  {
    heading: "What's Coming (Phase 2)",
    prefix: "phase2",
    items: [
      {
        q: "What's next and will I have to pay?",
        a: "Phase 2 (September) adds per-agent cost tracking, spend caps/model restrictions, team features, and higher-tier plans. Starter ($49/mo) already gives you unlimited audits and history. Team ($199/mo) adds departments, budgets, and policies. Support for more providers (Google, AWS, Azure) coming too.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
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
  );
}
