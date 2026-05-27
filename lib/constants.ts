// Auth constants
export const OWNER_EMAIL = "samarth@synthforceai.com";

// Cookie names
export const AUTH_COOKIE_NAME = "synthforce_auth";
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// Routes
export const PUBLIC_ROUTES = ["/", "/signup", "/login", "/about", "/product", "/demo", "/blog"];
export const PROTECTED_ROUTES = ["/LoginDashboard", "/owner"];
export const OWNER_ROUTES = ["/owner"];
