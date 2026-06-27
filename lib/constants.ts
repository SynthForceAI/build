// Auth constants. The platform owner is identified solely by this email; the
// session itself is always a real Supabase session (no custom auth cookie).
export const OWNER_EMAIL = "samarth@synthforceai.com";

// Routes
export const PUBLIC_ROUTES = ["/", "/signup", "/login", "/about", "/product", "/demo", "/blog"];
export const PROTECTED_ROUTES = ["/U", "/owner"];
export const OWNER_ROUTES = ["/owner"];
