import { ApiEndpoint } from "./apiDocsTypes";

const PASSWORD_ROUTE_DEPRECATION =
  "No page or app screen calls it, but the route is still live and public, and it creates accounts without verifying the email.";

export const apiDocsAuth: ApiEndpoint[] = [
  // Sessions
  {
    method: "GET",
    route: "/_api/auth/session",
    description: "Return the signed-in user's full profile and session state",
    auth: "any",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, avatarFileId, role ('student' | 'teacher' | 'admin'), mobileNumber, mobileVerified, emailVerified, bio, websiteUrl, publicEmail, publicPhone, socialLinks, awardsCertificates, languages, location, expertiseAreas, responseTime, tagline, slug, onboardingCompleted, isVerified, instituteType, academyName, yearsOfExperience, teachingCategories, targetExams, teachingExperienceLevel, currentOccupation, goals, discoverySource, schoolCollegeName, signupSource, examFocus (array of { id, examName, examSlug }), examFocusPromptDue }. Teachers also get teacherRole ('owner' | 'manager') and actingAsTeacherId" },
      { name: "impersonatorAdminId", type: "number", description: "Present only while an admin is impersonating this user" },
    ],
    notes: [
      "Returns 401 'Not authenticated' when the token or cookie is missing, invalid, expired, or its session no longer exists, and 400 'Session validation failed' on any other failure.",
      "Each call refreshes the session cookie and updates the session's last-accessed time (at most one database write every 5 minutes).",
      "The response never contains a token, so mobile clients keep the token they received at sign-in.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/logout",
    description: "Sign out by deleting the current session and clearing the session cookie",
    auth: "any",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the session was deleted" },
      { name: "message", type: "string", description: "Always 'Logged out successfully'" },
    ],
    notes: [
      "The request body is ignored and the response is plain JSON, not wrapped in { json }.",
      "Needs the session cookie or a bearer token. With neither, or with an invalid one, it returns 401 'Not authenticated'. A database failure returns 500.",
      "Deleting the session ends every token that carries that session, including the 90-day sign-in token and tokens from /_api/auth/api-token.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/establish_session",
    description: "Exchange the one-time token from the Google sign-in popup for a session cookie",
    auth: "none",
    category: "Authentication",
    usedBy: ["web"],
    bodyParams: [
      { name: "tempToken", type: "string", required: true, description: "One-time token that /_api/auth/oauth_callback posts to the opener window" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role, mobileNumber, mobileVerified, onboardingCompleted }" },
      { name: "success", type: "boolean", description: "Always true on success" },
      { name: "isNewUser", type: "boolean", description: "True when the account was created within the last 2 minutes" },
      { name: "redirectTo", type: "string", description: "Same-site path chosen at oauth_authorize. Omitted when none was set" },
    ],
    notes: [
      "The body is plain JSON { tempToken }, not wrapped in { json }, and the response is plain JSON.",
      "The token is single use and lives 5 minutes. An unknown, used or expired token returns 400.",
      "Sets the session cookie only. No bearer token is returned.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/api-token",
    description: "Issue a 30-day bearer token for the current session, for scripts and external clients",
    auth: "any",
    category: "Authentication",
    usedBy: [],
    responseFields: [
      { name: "token", type: "string", description: "Signed JWT to send as Authorization: Bearer <token>" },
      { name: "expiresIn", type: "string", description: "Always '30 days'" },
    ],
    notes: [
      "Send the body { \"json\": {} }. An empty body fails with 400.",
      "Returns 403 'API tokens can't be created from a browser.' when the request carries an Origin, Sec-Fetch-Mode or Sec-Fetch-Site header, so call it from a server or script.",
      "Returns 403 during an admin impersonation session and 401 without a valid session. Works with either the session cookie or an existing bearer token.",
      "The token carries the caller's current session, so signing out of that session ends it early.",
    ],
  },

  // Google sign-in
  {
    method: "GET",
    route: "/_api/auth/oauth_authorize",
    description: "Start Google sign-in by redirecting to the consent screen or returning its URL",
    auth: "optional",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    queryParams: [
      { name: "provider", type: "'google' | 'floot'", required: true, description: "OAuth provider. The site and the app only use 'google'" },
      { name: "role", type: "'student' | 'teacher'", required: false, description: "Role for an account created by this sign-in. Defaults to 'student'" },
      { name: "redirectTo", type: "string", required: false, description: "Web: a same-site path starting with a single '/'. Mobile: an app link starting with testkart:// (or exp:// on a local or private-network host). Any other value is dropped" },
      { name: "link_account", type: "string", required: false, description: "Pass 'true' to attach the Google email to the signed-in account instead of signing in. Needs a session" },
    ],
    responseFields: [
      { name: "(redirect)", type: "302", description: "Web flow: redirects to the Google consent screen and sets a 10-minute oauth_state cookie" },
      { name: "redirectUrl", type: "string", description: "Mobile flow only: returned as plain JSON with status 200 when redirectTo is an app link" },
    ],
    notes: [
      "Returns 400 for a bad provider, role or provider configuration, 401 for link_account=true without a session, and 500 when the state cannot be stored.",
      "The state, role and redirect are stored for 10 minutes.",
    ],
  },
  {
    method: "GET",
    route: "/_api/auth/oauth_callback",
    description: "Finish Google sign-in, then answer the popup page or redirect back to the app",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    queryParams: [
      { name: "state", type: "string", required: true, description: "State created by oauth_authorize. Must match a stored, unexpired state" },
      { name: "code", type: "string", required: false, description: "Authorization code from Google. Required unless error is present" },
      { name: "error", type: "string", required: false, description: "Error code Google returns when the user cancels or sign-in fails" },
      { name: "error_description", type: "string", required: false, description: "Accepted but not used" },
    ],
    responseFields: [
      { name: "(html)", type: "page", description: "Web flow: a small page that posts { type: 'OAUTH_TOKEN_SUCCESS', token, redirectTo } or { type: 'OAUTH_ERROR', error } to the opener window" },
      { name: "(redirect)", type: "302", description: "Mobile flow: redirects to <redirectTo>?token=<JWT> when the stored redirect was an app link" },
    ],
    notes: [
      "This is the redirect URI registered with Google. Clients do not call it directly.",
      "Finds or creates the account by the Google email. The requested role applies only when an account is created. New accounts get a welcome email.",
      "An existing email that has a password but no linked Google account is refused with an error page.",
      "Web flow: success returns a 5-minute one-time token that the opener exchanges through /_api/auth/establish_session. Mobile flow: creates a session and a 30-day JWT for the Authorization header.",
      "Errors come back as HTML pages with status 400 or 500, not JSON.",
    ],
  },

  // Mobile number sign-in and sign-up
  {
    method: "POST",
    route: "/_api/auth/mobile-login/send-otp",
    description: "Send a 4-digit sign-in code by SMS",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Exactly 10 digits" },
      { name: "turnstileToken", type: "string", required: false, description: "Cloudflare Turnstile token. Rejected with 403 when missing or invalid while Turnstile is configured, so always send it" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the SMS was sent" },
      { name: "message", type: "string", description: "'OTP sent to <number>'" },
    ],
    notes: [
      "Works for numbers with no account. /_api/auth/mobile-login/verify-otp creates the account.",
      "The code expires after 10 minutes.",
      "Returns 429 when a limit is hit: 45 seconds between sends to one number, 5 per hour and 8 per day per number, and 8 per hour and 20 per day per source IP.",
      "Validation failures return 400 with error as an array of issues. An SMS failure returns 500.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-login/verify-otp",
    description: "Verify the SMS code and sign in, creating the account if none exists",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Exactly 10 digits" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 4 digits" },
      { name: "role", type: "'user' | 'teacher'", required: false, description: "Role for a newly created account. Defaults to 'user', which creates a student" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role, mobileNumber, mobileVerified }" },
      { name: "token", type: "string", description: "Session JWT valid for 90 days, for Authorization: Bearer" },
    ],
    notes: [
      "Also sets the session cookie. The web uses the cookie and the mobile app uses the token.",
      "A new account gets the display name 'User_<id>' and a generated avatar. A new teacher gets the active free plan.",
      "Returns 400 for no pending code, an expired or wrong code, or a code with no attempts left (5 per code).",
      "Returns 429 after 10 wrong codes per number or 50 per source IP within an hour.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-signup/send-otp",
    description: "Send a 4-digit sign-up code by SMS to a number that has no account",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "10-digit Indian mobile number starting with 6-9" },
      { name: "role", type: "'student' | 'teacher'", required: true, description: "Role of the account being created" },
      { name: "email", type: "string", required: false, description: "Required when role is 'teacher' and must not belong to another account. Ignored for students" },
      { name: "turnstileToken", type: "string", required: false, description: "Cloudflare Turnstile token. Rejected with 403 when missing or invalid while Turnstile is configured, so always send it" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the SMS was sent" },
      { name: "message", type: "string", description: "'OTP sent successfully.'" },
    ],
    notes: [
      "Returns 409 when any account already uses the number, and 400 when a teacher sign-up has no email or the email is taken.",
      "Returns 429 on the same SMS limits as /_api/auth/mobile-login/send-otp. The code expires after 10 minutes.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/mobile-signup/verify-and-register",
    description: "Verify the SMS code and create a new student or teacher account",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "10-digit Indian mobile number starting with 6-9" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 4 digits" },
      { name: "displayName", type: "string", required: true, description: "2 to 100 characters, trimmed" },
      { name: "role", type: "'student' | 'teacher'", required: true, description: "Role of the new account" },
      { name: "email", type: "string", required: false, description: "Required for teachers and stored unverified. Ignored for students" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, displayName, email, avatarUrl, role, mobileNumber, mobileVerified: true }" },
      { name: "token", type: "string", description: "Session JWT valid for 90 days, for Authorization: Bearer" },
    ],
    notes: [
      "Also sets the session cookie.",
      "Returns 409 if the number was registered in the meantime, and 400 for a missing or taken teacher email or a bad, expired or exhausted code (5 attempts per code).",
      "Returns 429 after 10 wrong codes per number or 50 per source IP within an hour.",
      "A new teacher gets the active free plan.",
    ],
  },

  // Email sign-in and sign-up
  {
    method: "POST",
    route: "/_api/auth/email-login/send-otp",
    description: "Email a 6-digit sign-in code",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
      { name: "turnstileToken", type: "string", required: false, description: "Cloudflare Turnstile token. Rejected with 403 when missing or invalid while Turnstile is configured, so always send it" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the email was sent" },
      { name: "message", type: "string", description: "'OTP sent to <email>'" },
    ],
    notes: [
      "Works for addresses with no account. /_api/auth/email-login/verify-otp creates the account. The code expires after 10 minutes.",
      "Returns 429 only when the latest unexpired code already has 5 failed attempts. There is no per-address cooldown on this route.",
      "Validation failures return 400 with an array of issues. An email failure returns 500.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/email-login/verify-otp",
    description: "Verify the emailed code and sign in, creating the account if none exists",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 6 digits" },
      { name: "role", type: "'user' | 'teacher'", required: false, description: "Role for a newly created account. Defaults to 'user', which creates a student" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role, mobileNumber, mobileVerified }" },
      { name: "token", type: "string", description: "Session JWT valid for 90 days, for Authorization: Bearer" },
    ],
    notes: [
      "Also sets the session cookie.",
      "A new account is created with the email verified and the display name 'User_<id>'. The mobile app also finishes email sign-up through this route, so it collects no name.",
      "Returns 400 for no pending code or a bad, expired or exhausted code (5 attempts per code), and 429 after 10 wrong codes per address or 50 per source IP within an hour.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/email-signup/send-otp",
    description: "Email a 6-digit sign-up code to an address that has no account",
    auth: "none",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
      { name: "role", type: "'student' | 'teacher'", required: true, description: "Role of the account being created" },
      { name: "mobileNumber", type: "string", required: false, description: "10-digit Indian mobile number starting with 6-9. Required for teachers and must not belong to another account. Ignored for students" },
      { name: "turnstileToken", type: "string", required: false, description: "Cloudflare Turnstile token. Rejected with 403 when missing or invalid while Turnstile is configured, so always send it" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the email was sent" },
      { name: "message", type: "string", description: "'OTP sent successfully.'" },
    ],
    notes: [
      "Returns 409 when any account already has the email, and 400 when a teacher sign-up has no mobile number or the number is taken.",
      "Returns 429 after 5 codes to the same address within an hour. The code expires after 10 minutes.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/email-signup/verify-and-register",
    description: "Verify the emailed code and create a new student or teacher account",
    auth: "none",
    category: "Authentication",
    usedBy: ["web"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 6 digits" },
      { name: "displayName", type: "string", required: true, description: "2 to 100 characters, trimmed" },
      { name: "role", type: "'student' | 'teacher'", required: true, description: "Role of the new account" },
      { name: "mobileNumber", type: "string", required: false, description: "Required for teachers and stored unverified. Ignored for students" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, displayName, email, avatarUrl, role, mobileNumber, mobileVerified: false }" },
      { name: "token", type: "string", description: "Session JWT valid for 90 days, for Authorization: Bearer" },
    ],
    notes: [
      "Also sets the session cookie.",
      "Returns 409 if the email was registered in the meantime, and 400 for a missing or taken teacher mobile number or a bad, expired or exhausted code (5 attempts per code).",
      "Returns 429 after 10 wrong codes per address or 50 per source IP within an hour.",
      "Students get a welcome email. Teachers get the active free plan.",
    ],
  },

  // Verifying a contact on a signed-in account
  {
    method: "POST",
    route: "/_api/auth/send_otp",
    description: "Send a 4-digit SMS code to verify a mobile number on the signed-in account",
    auth: "any",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Indian mobile number starting with 6-9, with an optional +91 prefix" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the SMS was sent" },
      { name: "message", type: "string", description: "'OTP sent successfully.'" },
    ],
    notes: [
      "Returns 401 without a valid session and 409 when another account already has this number verified.",
      "Returns 429 on the SMS limits (45-second gap, 5 per hour and 8 per day per number, 8 per hour and 20 per day per IP) plus 5 per hour and 10 per day per account.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/verify_otp",
    description: "Verify the SMS code and save the number as the signed-in account's verified mobile",
    auth: "any",
    category: "Authentication",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "mobileNumber", type: "string", required: true, description: "Indian mobile number starting with 6-9, with an optional +91 prefix" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 4 characters" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the number was verified" },
      { name: "message", type: "string", description: "'Mobile number verified successfully.'" },
    ],
    notes: [
      "Returns 401 without a valid session, 404 when there is no pending code, 410 when the code has expired, 400 for a wrong code and 409 when another account has the number verified.",
      "Returns 429 after 5 attempts on one code, or after 10 wrong codes per number or 50 per IP within an hour.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/send-email-otp",
    description: "Email a 6-digit code to verify an address on the signed-in account",
    auth: "any",
    category: "Authentication",
    usedBy: ["web"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the email was sent" },
      { name: "message", type: "string", description: "'Verification email sent successfully.'" },
    ],
    notes: [
      "Returns 401 without a valid session and 409 when another account already uses the address.",
      "Returns 429 on a 45-second gap, 5 per hour and 8 per day per address, and 5 per hour and 10 per day per account. The code expires after 10 minutes.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/verify-email-otp",
    description: "Verify the emailed code and save the address as the signed-in account's verified email",
    auth: "any",
    category: "Authentication",
    usedBy: ["web"],
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Trimmed and lowercased" },
      { name: "otpCode", type: "string", required: true, description: "Exactly 6 characters" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the address was verified" },
      { name: "message", type: "string", description: "'Email address verified successfully.'" },
    ],
    notes: [
      "Returns 401 without a valid session, 404 when there is no pending code, 410 when the code has expired, 400 for a wrong code and 409 when another account uses the address.",
      "Returns 429 after 5 attempts on one code, or after 10 wrong codes per address or 50 per IP within an hour.",
    ],
  },

  // Password routes left over from the original template
  {
    method: "POST",
    route: "/_api/auth/login_with_password",
    description: "Sign in with email and password and set the session cookie",
    auth: "none",
    category: "Authentication",
    usedBy: [],
    deprecated: "Use /_api/auth/email-login/send-otp and /_api/auth/email-login/verify-otp, or the mobile-login pair, instead. No page or app screen calls it, but the route is still live and public.",
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Account email. Compared case-insensitively" },
      { name: "password", type: "string", required: true, description: "Account password" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role }" },
    ],
    notes: [
      "Plain JSON body and response, not wrapped in { json }. Failures use { message }, not { error }: 401 for a wrong email or password, 400 for a bad body.",
      "Returns 429 after 5 failed attempts for the same email within 15 minutes.",
      "Sets the session cookie only. No bearer token is returned. Only accounts with a stored password can use it, and OTP and Google accounts have none.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/register_with_password",
    description: "Register a student account with email and password and sign in",
    auth: "none",
    category: "Authentication",
    usedBy: [],
    deprecated: `Use /_api/auth/email-signup/send-otp and /_api/auth/email-signup/verify-and-register, or the mobile-signup pair, instead. ${PASSWORD_ROUTE_DEPRECATION}`,
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address. Stored as sent, not lowercased" },
      { name: "password", type: "string", required: true, description: "At least 8 characters" },
      { name: "displayName", type: "string", required: true, description: "At least 1 character" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, createdAt, role: 'student' }" },
    ],
    notes: [
      "Plain JSON body and response, not wrapped in { json }. Failures use { message }: 409 when the email is taken, 400 otherwise.",
      "Sets the session cookie only and sends the student welcome email.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/register_student",
    description: "Register a student account with email and password and sign in",
    auth: "none",
    category: "Authentication",
    usedBy: [],
    deprecated: `Use /_api/auth/email-signup/send-otp and /_api/auth/email-signup/verify-and-register with role 'student', or the mobile-signup pair, instead. ${PASSWORD_ROUTE_DEPRECATION}`,
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address" },
      { name: "password", type: "string", required: true, description: "At least 8 characters" },
      { name: "displayName", type: "string", required: true, description: "At least 1 character" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role: 'student', mobileNumber, mobileVerified }" },
    ],
    notes: [
      "Returns 409 'Email already in use' when an account has that exact email, and 400 for anything else.",
      "Sets the session cookie only (no token in the body) and sends the welcome email before responding.",
    ],
  },
  {
    method: "POST",
    route: "/_api/auth/register_teacher",
    description: "Register a teacher account with email and password and sign in",
    auth: "none",
    category: "Authentication",
    usedBy: [],
    deprecated: `Use /_api/auth/email-signup/send-otp and /_api/auth/email-signup/verify-and-register with role 'teacher', or the mobile-signup pair, instead. ${PASSWORD_ROUTE_DEPRECATION}`,
    bodyParams: [
      { name: "email", type: "string", required: true, description: "Email address" },
      { name: "password", type: "string", required: true, description: "At least 8 characters" },
      { name: "displayName", type: "string", required: true, description: "At least 1 character" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "{ id, email, displayName, avatarUrl, role: 'teacher', mobileNumber, mobileVerified }" },
    ],
    notes: [
      "Returns 409 'Email already in use' when an account has that exact email, and 400 for anything else.",
      "Creates the teacher with a profile slug and the active free plan and sets the session cookie. It does not ask for the mobile number that the OTP sign-up routes require from teachers.",
    ],
  },

  // Account
  {
    method: "POST",
    route: "/_api/student/profile/update",
    description: "Update the signed-in student's display name, bio or avatar",
    auth: "student",
    category: "Account",
    usedBy: ["web", "mobile"],
    bodyParams: [
      { name: "displayName", type: "string", required: false, description: "At least 2 characters" },
      { name: "bio", type: "string", required: false, description: "Up to 500 characters" },
      { name: "avatarUrl", type: "string", required: false, description: "Absolute URL, an empty string, or null" },
      { name: "avatarFileId", type: "string", required: false, description: "Id of an uploaded avatar file, or null" },
    ],
    responseFields: [
      { name: "(user)", type: "object", description: "The updated user at the top level, not wrapped in { user }: { id, displayName, email, avatarUrl, role, bio, websiteUrl, socialLinks, awardsCertificates, mobileNumber, mobileVerified }" },
    ],
    notes: [
      "Send at least one field. An empty body returns 400 'No update data provided', and unknown fields such as location are rejected with 400.",
      "Teachers get 403. Admin-role accounts are accepted as well as students. A signed-out call returns 401.",
    ],
  },
  {
    method: "GET",
    route: "/_api/account/billing-details",
    description: "Get the saved invoice billing details for the signed-in account",
    auth: "any",
    category: "Account",
    usedBy: ["web"],
    responseFields: [
      { name: "billingDetails", type: "object", description: "{ name, email, phone, address, gstin }, or null when nothing is saved" },
    ],
    notes: [
      "A teacher team manager gets the owner teacher's details.",
      "Returns 401 without a valid session.",
    ],
  },
  {
    method: "POST",
    route: "/_api/account/billing-details",
    description: "Save the invoice billing details for the signed-in account",
    auth: "any",
    category: "Account",
    usedBy: ["web"],
    bodyParams: [
      { name: "name", type: "string", required: true, description: "2 to 200 characters" },
      { name: "address", type: "string", required: true, description: "5 to 500 characters" },
      { name: "email", type: "string", required: false, description: "Email address or an empty string" },
      { name: "phone", type: "string", required: false, description: "Up to 30 characters" },
      { name: "gstin", type: "string", required: false, description: "15 uppercase letters or digits. An empty value is stored as null" },
    ],
    responseFields: [
      { name: "billingDetails", type: "object", description: "The saved { name, email, phone, address, gstin }" },
    ],
    notes: [
      "Replaces any saved details completely. Unknown fields are rejected with 400.",
      "A teacher team manager writes the owner teacher's record. Returns 401 without a valid session.",
    ],
  },
  {
    method: "POST",
    route: "/_api/account/close-request",
    description: "Permanently delete the signed-in account and its data",
    auth: "any",
    category: "Account",
    usedBy: ["web"],
    bodyParams: [
      { name: "reason", type: "string", required: false, description: "Free-text reason saved with the deletion record" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the account was deleted" },
      { name: "message", type: "string", description: "'Your account has been permanently deleted.'" },
    ],
    notes: [
      "Despite the name there is no review step. The account is deleted at once and cannot be restored.",
      "Removes the user's sessions and owned data, clears the session cookie and sends a closure confirmation email when the account has an email.",
      "Returns 409 and changes nothing when something blocks deletion, such as students having bought the teacher's tests or the user having written a blog post.",
      "The mobile app opens the web /close-account page instead of calling this route.",
    ],
  },
  {
    method: "POST",
    route: "/_api/email/unsubscribe",
    description: "Opt the owner of a signed email link out of one optional email list",
    auth: "signature",
    category: "Account",
    usedBy: ["web"],
    bodyParams: [
      { name: "list", type: "'teacher_onboarding'", required: true, description: "The list to leave. Only 'teacher_onboarding' exists today" },
      { name: "token", type: "string", required: true, description: "The signed token from the email link (its t parameter)" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True when the opt-out was recorded" },
    ],
    notes: [
      "Needs no sign-in. The token is an HMAC of the user and the list, so it cannot be forged for someone else.",
      "list and token can be sent in the query string as ?list=...&t=... instead, which is how mail apps call it for one-click unsubscribe.",
      "Returns 400 'This unsubscribe link is not valid.' for an unknown list or a bad token. Safe to repeat.",
    ],
  },
];
