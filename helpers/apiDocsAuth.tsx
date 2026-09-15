import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsAuth: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/auth/session",
    description: "Get current user session",
    auth: "none",
    category: "Authentication",
    responseFields: [
      { name: "user", type: "object", description: "User object if authenticated" },
      { name: "impersonatorAdminId", type: "number", description: "Set when an admin is impersonating this user" },
      { name: "error", type: "string", description: "Error message if not authenticated" },
    ],
    notes: [
      "Supports both cookie-based auth (web) and Bearer token auth (mobile)",
      "Send Authorization: Bearer <token> header for mobile/API access",
      "Returns the full user profile including avatar, bio, social links, etc."
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/logout",
    description: "Log out the current user",
    auth: "any",
    category: "Authentication",
    responseFields: [
      { name: "success", type: "boolean", description: "True if the logout was successful" },
    ],
    notes: [
      "Supports both cookie-based auth (web) and Bearer token auth (mobile)",
      "Deletes the session from the database"
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/login_with_password",
    description: "Log in with email and password",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "email", type: "string", required: true, description: "User's email address" },
      { name: "password", type: "string", required: true, description: "User's password" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Authenticated user object" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
    notes: [
      "Rate limited: 5 failed attempts locks the account for 15 minutes"
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/register_student",
    description: "Register a new student account",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Student's email address" },
      { name: "password", type: "string", required: true, description: "Desired password" },
      { name: "displayName", type: "string", required: true, description: "Student's display name" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Newly created user object" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/register_with_password",
    description: "Register a new account with email and password",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "email", type: "string", required: true, description: "User's email address" },
      { name: "password", type: "string", required: true, description: "Desired password" },
      { name: "displayName", type: "string", required: true, description: "User's display name" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Newly created user object" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-login/send-otp",
    description: "Send OTP to a mobile number for login",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Mobile number to send the OTP to" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if OTP was sent successfully" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
    notes: [
      "OTP is sent even if no user exists, supporting a seamless login/signup flow"
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-login/verify-otp",
    description: "Verify OTP and log in the user",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Mobile number that received the OTP" },
      { name: "otp", type: "string", required: true, description: "The OTP code to verify" },
      { name: "role", type: "string", required: false, description: "Optional role ('user' or 'teacher', defaults to 'user'). Used to auto-create account if no user exists." },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Authenticated user object on success" },
      { name: "token", type: "string", description: "JWT Bearer token for mobile/API authentication" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
    notes: [
      "If no user exists, an account is automatically created with the provided role.",
      "Returns a JWT token in the response body alongside the session cookie for mobile/API use"
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-signup/send-otp",
    description: "Send OTP to a mobile number for new account registration",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Mobile number to register" },
      { name: "role", type: "string", required: true, description: "Role for the new account ('student' or 'teacher')" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if OTP was sent successfully" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-signup/verify-and-register",
    description: "Verify OTP and complete new account registration via mobile",
    auth: "none",
    category: "Authentication",
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Mobile number being registered" },
      { name: "otp", type: "string", required: true, description: "The OTP code to verify" },
      { name: "displayName", type: "string", required: true, description: "User's display name" },
      { name: "role", type: "string", required: true, description: "Role for the new account ('student' or 'teacher')" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Newly created and authenticated user object" },
      { name: "token", type: "string", description: "JWT Bearer token for mobile/API authentication" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
    notes: [
      "Returns a JWT token in the response body alongside the session cookie for mobile/API use"
    ],
  },
  {
    method: "GET",
    route: "/_api/auth/oauth_authorize",
    description: "Initiate an OAuth authorization flow (e.g. Google)",
    auth: "none",
    category: "Authentication",
    queryParams: [
      { name: "provider", type: "string", required: true, description: "OAuth provider name (e.g. 'google')" },
      { name: "role", type: "string", required: true, description: "Requested role: 'student' or 'teacher'" },
      { name: "redirectTo", type: "string", required: false, description: "For web: local path to redirect after login (e.g. '/dashboard'). For mobile: deep link URL where the server redirects after OAuth (e.g. 'starterkit://auth'). When a deep link is provided, the endpoint returns JSON instead of a 302 redirect." },
    ],
    responseFields: [
      { name: "redirectUrl", type: "string", description: "Google consent screen URL. Only returned as JSON when redirectTo is a deep link (mobile flow). For web flow, the endpoint redirects (302) directly." },
    ],
    notes: [
      "Web flow: Returns 302 redirect to Google consent screen",
      "Mobile flow: When redirectTo is a deep link URL (e.g. starterkit://auth), returns JSON { redirectUrl } instead of redirecting",
      "The state parameter encodes the redirectTo and role for use in the callback"
    ],
  },
  {
    method: "GET",
    route: "/_api/auth/oauth_callback",
    description: "Handle OAuth provider callback. For web: returns popup HTML with postMessage. For mobile: redirects to the deep link URL with a JWT token.",
    auth: "none",
    category: "Authentication",
    queryParams: [
      { name: "code", type: "string", required: true, description: "Authorization code from the OAuth provider" },
      { name: "state", type: "string", required: true, description: "State parameter for CSRF protection" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Authenticated or newly created user object" },
      { name: "error", type: "string", description: "Error message on failure" },
      { name: "token", type: "string", description: "JWT Bearer token appended as ?token=<JWT> to the deep link redirect (mobile flow only)" },
    ],
    notes: [
      "Web flow: Returns HTML page that posts message to opener window",
      "Mobile flow: When the original redirectTo was a deep link, redirects to <redirectTo>?token=<JWT> with a 30-day Bearer token",
      "The JWT can be used with Authorization: Bearer <token> header for all authenticated endpoints"
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/api-token",
    description: "Generate a long-lived Bearer token for the authenticated user (useful for API access). Refused for requests sent from a browser page and for impersonation sessions",
    auth: "any",
    category: "Authentication",
    responseFields: [
      { name: "token", type: "string", description: "JWT Bearer token valid for 30 days" },
      { name: "expiresIn", type: "string", description: "Token expiry description" },
    ],
    notes: [
      "Requires an existing authenticated session (cookie-based)",
      "The returned token can be used with Authorization: Bearer <token> header"
    ],
  },
];