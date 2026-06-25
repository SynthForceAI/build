/**
 * Marketing layout - wraps every public-facing page
 * (home, product, demo, blog, about, waitlist).
 *
 * WHY this exists as a separate layout:
 * The root app/layout.tsx handles the HTML shell (fonts, analytics, Tally
 * script) and applies to ALL pages - including the dashboard. The Footer
 * belongs only on marketing pages, so it lives here inside the (marketing)
 * route group instead of in the root layout.
 *
 * Route groups like "(marketing)" don't add a URL segment - /product still
 * routes to app/(marketing)/product/page.tsx exactly as before.
 */
import { Footer } from "@/components/ui/footer";
import { getUser } from "@/lib/auth";
import { SiteNav } from "@/components/ui/site-nav";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getUser();
  const user = auth ? { name: auth.user.name ?? "", email: auth.user.email } : null;
  return (
    <>
      <SiteNav user={user}/>
      {children}
      <Footer />
    </>
  );
}
