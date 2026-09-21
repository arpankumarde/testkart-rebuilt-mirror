/**
 * Per-admin access control. Each admin holds a list of module keys (admins.permissions); a module
 * unlocks its admin pages and the admin endpoints behind them. The role is only a label now.
 *
 * Shared by the server (getAdminSession enforces API_RULES on every admin endpoint, which the MCP
 * connector reaches through the same handlers) and the client (navigation and route guards).
 */

export const ADMIN_MODULE_GROUPS = [
  "Overview",
  "Sales",
  "Finance",
  "Users",
  "Catalogue",
  "Content",
  "Site",
  "AI",
] as const;

export type AdminModuleGroup = (typeof ADMIN_MODULE_GROUPS)[number];

export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard", group: "Overview", hint: "Revenue, orders and growth figures" },
  { key: "sales", label: "Sales pipeline", group: "Sales", hint: "Leads, demo requests and follow-ups" },
  { key: "finance", label: "Finance overview", group: "Finance", hint: "Revenue, fees and payouts summary" },
  { key: "transactions", label: "Transactions", group: "Finance", hint: "Orders, refunds, reconciliation and invoices" },
  { key: "subscriptions", label: "Subscriptions", group: "Finance", hint: "Teacher plans, trials and payments" },
  { key: "teacher_earnings", label: "Teacher earnings", group: "Finance", hint: "Wallet balances and manual payouts" },
  { key: "teacher_withdrawals", label: "Teacher withdrawals", group: "Finance", hint: "Approve and process payout requests" },
  { key: "teacher_bank_details", label: "Teacher bank details", group: "Finance", hint: "Bank and KYC verification" },
  { key: "student_withdrawals", label: "Student withdrawals", group: "Finance", hint: "Prize payout requests" },
  { key: "student_bank_details", label: "Student bank details", group: "Finance", hint: "Bank and KYC verification" },
  { key: "teachers", label: "Teachers", group: "Users", hint: "Teacher accounts, verification, DRM and sign-in as" },
  { key: "students", label: "Students", group: "Users", hint: "Student accounts and sign-in as" },
  { key: "teacher_inquiries", label: "Teacher inquiries", group: "Users", hint: "Institute and teacher leads" },
  { key: "contact_submissions", label: "Contact submissions", group: "Users", hint: "Contact form messages" },
  { key: "deleted_accounts", label: "Deleted accounts", group: "Users", hint: "Accounts removed by their owners" },
  { key: "support", label: "Support inbox", group: "Users", hint: "Teacher support threads" },
  { key: "catalogue", label: "Catalogue dashboard", group: "Catalogue", hint: "Catalogue coverage and pipeline" },
  { key: "content_reviews", label: "Content reviews", group: "Catalogue", hint: "Approve teacher content before it goes live" },
  { key: "courses", label: "Courses", group: "Catalogue", hint: "Courses and their lessons" },
  { key: "notes", label: "Study notes", group: "Catalogue", hint: "Digital products" },
  { key: "test_series", label: "Test series", group: "Catalogue", hint: "Mock tests" },
  { key: "live_tests", label: "Live tests", group: "Catalogue", hint: "Competitions and prize distribution" },
  { key: "bundles", label: "Bundles", group: "Catalogue", hint: "Course bundles" },
  { key: "content", label: "Content dashboard", group: "Content", hint: "Site content overview" },
  { key: "exam_content", label: "Exam content", group: "Content", hint: "Exams, categories, subjects and exam pages" },
  { key: "blog", label: "Blog posts", group: "Content", hint: "Blog and help articles, categories" },
  { key: "blog_comments", label: "Blog comments", group: "Content", hint: "Comment moderation" },
  { key: "careers", label: "Careers", group: "Site", hint: "Job postings and applications" },
  { key: "news", label: "News and events", group: "Site", hint: "Press coverage" },
  { key: "static_pages", label: "Static pages", group: "Site", hint: "Terms, privacy, about" },
  { key: "email_templates", label: "Email templates", group: "Site", hint: "Transactional emails" },
  { key: "api_docs", label: "API docs", group: "Site", hint: "Endpoint reference" },
  { key: "settings", label: "Site settings", group: "Site", hint: "Scripts, AI provider, upload limits, well-known files" },
  { key: "admins", label: "Admins and access", group: "Site", hint: "Create admins and choose what each can open" },
  { key: "ai_questions", label: "AI questions", group: "AI", hint: "Generated question review and export" },
  { key: "ai_usage", label: "AI usage", group: "AI", hint: "Generation logs and failures" },
] as const satisfies readonly { key: string; label: string; group: AdminModuleGroup; hint: string }[];

export type AdminModule = (typeof ADMIN_MODULES)[number]["key"];

export const ADMIN_MODULE_KEYS: readonly AdminModule[] = ADMIN_MODULES.map((m) => m.key);

const MODULE_SET: ReadonlySet<string> = new Set(ADMIN_MODULE_KEYS);

export const isAdminModule = (value: string): value is AdminModule => MODULE_SET.has(value);

/** Drops unknown keys and duplicates, keeping catalogue order. */
export function normalizeAdminPermissions(value: unknown): AdminModule[] {
  if (!Array.isArray(value)) return [];
  const held = new Set(value.filter((v): v is string => typeof v === "string"));
  return ADMIN_MODULE_KEYS.filter((key) => held.has(key));
}

export function hasAdminModule(
  permissions: readonly string[] | null | undefined,
  modules: readonly AdminModule[]
): boolean {
  if (!permissions) return false;
  return modules.some((m) => permissions.includes(m));
}

/**
 * Any signed-in admin. The session and profile, the dashboard overview (it filters its own
 * figures), and lookups the pickers on many pages share: exam names and admin names.
 */
export const ANY_ADMIN = "any" as const;

type ApiRule = typeof ANY_ADMIN | readonly AdminModule[];

const CATALOGUE_PREVIEW: readonly AdminModule[] = [
  "content_reviews",
  "courses",
  "notes",
  "test_series",
  "live_tests",
  "bundles",
];

/**
 * Admin endpoint prefix (path after /_api/) to the modules that may call it; holding any one is
 * enough. The longest matching prefix wins. An admin/* path with no rule is refused, so a new
 * admin endpoint must be added here.
 */
const API_RULES: Record<string, ApiRule> = {
  "admin/session": ANY_ADMIN,
  "admin/logout": ANY_ADMIN,
  "admin/profile": ANY_ADMIN,
  "admin/stopImpersonating": ANY_ADMIN,
  "admin/ai-connections": ANY_ADMIN,
  "admin/dashboard/overview": ANY_ADMIN,
  "admin/admins/options": ANY_ADMIN,
  "admin/exams/list": ANY_ADMIN,
  "admin/exam-categories/list": ANY_ADMIN,

  "admin/dashboard/trends": ["dashboard"],
  "admin/stats": ["dashboard"],

  "admin/sales": ["sales"],
  "admin/sync-contacts-to-resend": ["sales"],

  "admin/finance": ["finance"],
  "admin/orders": ["transactions"],
  "admin/payments": ["transactions"],
  "admin/subscriptions": ["subscriptions"],
  "admin/subscription-transactions": ["subscriptions"],
  "admin/subscription-plans": ["subscriptions"],
  "admin/settings/subscription": ["subscriptions"],
  "admin/earnings": ["teacher_earnings"],
  "admin/withdrawals": ["teacher_withdrawals"],
  "admin/bank-details": ["teacher_bank_details"],
  "admin/student-withdrawals": ["student_withdrawals"],
  "admin/student-bank-details": ["student_bank_details"],

  "admin/teachers": ["teachers"],
  "admin/user/toggle-verified": ["teachers"],
  "admin/user/toggle-status": ["teachers", "students"],
  "admin/impersonate": ["teachers", "students"],
  "admin/students": ["students"],
  "admin/inquiries": ["teacher_inquiries"],
  "admin/contact-submissions": ["contact_submissions"],
  "admin/deleted-accounts": ["deleted_accounts"],
  "admin/support": ["support"],

  "admin/catalogue": ["catalogue"],
  "admin/content-reviews": ["content_reviews"],
  "admin/content-preview": CATALOGUE_PREVIEW,
  "admin/courses": ["courses"],
  "admin/products": ["notes"],
  "admin/tests": ["test_series"],
  "admin/live-tests": ["live_tests"],
  "live-tests/distribute-prizes": ["live_tests"],
  "admin/bundles": ["bundles"],

  "admin/content/dashboard": ["content"],
  "admin/exam-content": ["exam_content"],
  "admin/exam-dashboard": ["exam_content"],
  "admin/exam-categories": ["exam_content"],
  "admin/exam-subjects": ["exam_content"],
  "admin/exams": ["exam_content"],
  "admin/custom-exam-names": ["exam_content"],
  "admin/blog/comments": ["blog_comments"],
  "admin/blog": ["blog"],

  "admin/careers": ["careers"],
  "admin/news": ["news"],
  "admin/static-pages": ["static_pages"],
  "admin/email-templates": ["email_templates"],
  "admin/settings/ai-provider": ["settings"],
  "admin/scripts": ["settings"],
  "admin/well-known": ["settings"],
  "admin/upload-limits": ["settings"],
  "admin/r2-list": ["settings"],
  "admin/admins": ["admins"],

  "admin/ai-questions": ["ai_questions"],
  "admin/ai-usage": ["ai_usage"],
};

const RULE_PREFIXES = Object.keys(API_RULES).sort((a, b) => b.length - a.length);

/** "/_api/admin/blog/posts/list" or "admin/blog/posts/list" to "admin/blog/posts/list". */
export function adminApiRouteKey(pathname: string): string {
  return pathname.replace(/^\/+/, "").replace(/^_api\//, "").replace(/\/+$/, "");
}

/** The rule for an endpoint path, or undefined when none matches. */
export function adminApiRule(pathname: string): ApiRule | undefined {
  const key = adminApiRouteKey(pathname);
  const prefix = RULE_PREFIXES.find((p) => key === p || key.startsWith(`${p}/`));
  return prefix ? API_RULES[prefix] : undefined;
}

export function canCallAdminApi(permissions: readonly string[], pathname: string): boolean {
  const rule = adminApiRule(pathname);
  if (rule === undefined) return false;
  return rule === ANY_ADMIN || hasAdminModule(permissions, rule);
}

/**
 * Admin pages that are not in the sidebar, to the modules that open them. Sidebar pages carry
 * their module on the nav item (helpers/adminNavigation).
 */
export const EXTRA_PAGE_RULES: Record<string, ApiRule> = {
  "/admin/profile": ANY_ADMIN,
  "/admin/preview": CATALOGUE_PREVIEW,
  "/admin/settings": ["settings", "admins"],
};
