import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  History,
  Megaphone,
  PieChart,
  Receipt,
  CreditCard,
  Wallet,
  Landmark,
  ArrowDownToLine,
  GraduationCap,
  Users,
  MessageSquare,
  Inbox,
  UserX,
  LifeBuoy,
  ClipboardCheck,
  Library,
  MonitorPlay,
  FileText,
  ListChecks,
  Radio,
  Package,
  Newspaper,
  MessageCircle,
  Briefcase,
  Layout,
  Mail,
  FileCode2,
  Settings,
  Sparkles,
  Activity,
} from "lucide-react";
import { ANY_ADMIN, EXTRA_PAGE_RULES, hasAdminModule, type AdminModule } from "./adminPermissions";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** The admin needs any one of these modules (helpers/adminPermissions) to see and open the page. */
  modules: AdminModule[];
  /** Attention counters that show as a pending badge next to the item. */
  countKeys?: (keyof AttentionCounts)[];
  /** Extra words the command palette should match on. */
  keywords?: string;
};

export type AdminNavGroup = {
  key: string;
  label: string;
  items: AdminNavItem[];
};

/** The modules an admin holds; null while signed out or loading. */
export type AdminPermissionList = readonly string[] | null;

const groups: AdminNavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, modules: ["dashboard"], keywords: "home overview" },
      { href: "/admin/dashboard/old", label: "Dashboard (old)", icon: History, modules: ["dashboard"], keywords: "legacy previous metrics month" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    items: [
      {
        href: "/admin/sales",
        label: "Sales pipeline",
        icon: Megaphone,
        modules: ["sales"],
        countKeys: ["demoRequestsNew", "followupsOverdue"],
        keywords: "leads demo requests follow-ups crm",
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { href: "/admin/finance", label: "Finance overview", icon: PieChart, modules: ["finance"], keywords: "revenue fees payouts" },
      { href: "/admin/transactions", label: "Transactions", icon: Receipt, modules: ["transactions"], countKeys: ["staleOrders"], keywords: "orders payments payu invoices" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, modules: ["subscriptions"], countKeys: ["subscriptionsExpiring7d"], keywords: "plans trials mandates" },
      { href: "/admin/teachers/earnings", label: "Teacher earnings", icon: Wallet, modules: ["teacher_earnings"], keywords: "wallet balance" },
      { href: "/admin/teachers/withdrawals", label: "Withdrawal requests", icon: ArrowDownToLine, modules: ["teacher_withdrawals"], countKeys: ["teacherWithdrawals"], keywords: "payout teacher" },
      { href: "/admin/teachers/bank-details", label: "Bank details", icon: Landmark, modules: ["teacher_bank_details"], countKeys: ["teacherBankPending"], keywords: "verify kyc pan teacher" },
      { href: "/admin/students/withdrawals", label: "Student withdrawals", icon: ArrowDownToLine, modules: ["student_withdrawals"], countKeys: ["studentWithdrawals"], keywords: "payout prize" },
      { href: "/admin/students/bank-details", label: "Student bank details", icon: Landmark, modules: ["student_bank_details"], countKeys: ["studentBankPending"], keywords: "verify kyc pan" },
    ],
  },
  {
    key: "users",
    label: "Users",
    items: [
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap, modules: ["teachers"], keywords: "impersonate verify" },
      { href: "/admin/students", label: "Students", icon: Users, modules: ["students"], keywords: "learners" },
      { href: "/admin/teachers/inquiries", label: "Teacher inquiries", icon: MessageSquare, modules: ["teacher_inquiries"], countKeys: ["inquiriesPending"], keywords: "institute leads" },
      { href: "/admin/contact-submissions", label: "Contact submissions", icon: Inbox, modules: ["contact_submissions"], countKeys: ["contactNew"], keywords: "messages contact form" },
      { href: "/admin/deleted-accounts", label: "Deleted accounts", icon: UserX, modules: ["deleted_accounts"] },
      { href: "/admin/support", label: "Support inbox", icon: LifeBuoy, modules: ["support"], countKeys: ["supportUnread"], keywords: "tickets threads help" },
    ],
  },
  {
    key: "content",
    label: "Catalogue",
    items: [
      { href: "/admin/catalogue", label: "Catalogue dashboard", icon: LayoutDashboard, modules: ["catalogue"], keywords: "catalogue overview coverage publishing gaps tests courses notes" },
      { href: "/admin/content-reviews", label: "Content reviews", icon: ClipboardCheck, modules: ["content_reviews"], countKeys: ["reviewsPending"], keywords: "approve moderation" },
      { href: "/admin/courses", label: "Courses", icon: MonitorPlay, modules: ["courses"] },
      { href: "/admin/notes", label: "Study notes", icon: FileText, modules: ["notes"], keywords: "digital products pdf" },
      { href: "/admin/test-series", label: "Test series", icon: ListChecks, modules: ["test_series"], keywords: "mock tests" },
      { href: "/admin/live-tests", label: "Live tests", icon: Radio, modules: ["live_tests"], countKeys: ["prizesUndistributed"], keywords: "competitions prizes" },
      { href: "/admin/bundles", label: "Bundles", icon: Package, modules: ["bundles"] },
    ],
  },
  {
    key: "knowledge",
    label: "Content",
    items: [
      { href: "/admin/content", label: "Content dashboard", icon: LayoutDashboard, end: true, modules: ["content"], keywords: "site content seo blog guides pages editorial metadata" },
      { href: "/admin/exam-content", label: "Exam content", icon: Library, modules: ["exam_content"], keywords: "exams subjects categories" },
      { href: "/admin/blog", label: "Blog posts", icon: Newspaper, modules: ["blog"], keywords: "articles seo categories" },
      { href: "/admin/blog/comments", label: "Comments", icon: MessageCircle, modules: ["blog_comments"], countKeys: ["blogCommentsPending"], keywords: "moderate blog" },
    ],
  },
  {
    key: "site",
    label: "Site",
    items: [
      { href: "/admin/careers", label: "Careers", icon: Briefcase, modules: ["careers"], keywords: "jobs applications" },
      { href: "/admin/news", label: "News & Events", icon: Newspaper, modules: ["news"], keywords: "press coverage media mentions" },
      { href: "/admin/static-pages", label: "Static pages", icon: Layout, modules: ["static_pages"], keywords: "terms privacy about" },
      { href: "/admin/email-templates", label: "Email templates", icon: Mail, modules: ["email_templates"], keywords: "resend notifications" },
      { href: "/admin/api-docs", label: "API docs", icon: FileCode2, modules: ["api_docs"], keywords: "endpoints reference" },
      { href: "/admin/settings", label: "Settings", icon: Settings, modules: ["settings", "admins"], keywords: "admins roles access permissions ai provider scripts" },
    ],
  },
  {
    key: "ai",
    label: "AI",
    items: [
      { href: "/admin/ai-questions", label: "AI questions", icon: Sparkles, modules: ["ai_questions"], keywords: "generated review export" },
      { href: "/admin/ai-usage", label: "AI usage", icon: Activity, modules: ["ai_usage"], countKeys: ["aiFailed7d"], keywords: "logs failures teachers" },
    ],
  },
];

const isAllowed = (item: AdminNavItem, permissions: AdminPermissionList): boolean =>
  hasAdminModule(permissions, item.modules);

const visibleGroups = (permissions: AdminPermissionList): AdminNavGroup[] =>
  groups
    .map((group) => ({ ...group, items: group.items.filter((item) => isAllowed(item, permissions)) }))
    .filter((group) => group.items.length > 0);

const countFor = (item: AdminNavItem, attention: AttentionCounts | undefined): number => {
  if (!attention || !item.countKeys) return 0;
  return item.countKeys.reduce((sum, key) => sum + (attention[key] ?? 0), 0);
};

const groupCount = (group: AdminNavGroup, attention: AttentionCounts | undefined): number =>
  group.items.reduce((sum, item) => sum + countFor(item, attention), 0);

/** The most specific item for a path, so /admin/teachers/earnings picks Teacher earnings, not Teachers. */
const findByPath = (pathname: string): AdminNavItem | undefined => {
  const path = pathname.split("?")[0];
  let match: AdminNavItem | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      const hit = item.end ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
      if (hit && (!match || item.href.length > match.href.length)) match = item;
    }
  }
  return match;
};

/** Which pages an admin can open, given a path that may carry a query string. */
const canOpen = (href: string, permissions: AdminPermissionList): boolean => {
  const item = findByPath(href);
  if (item) return isAllowed(item, permissions);
  const path = href.split("?")[0];
  const extra = Object.keys(EXTRA_PAGE_RULES).find((p) => path === p || path.startsWith(`${p}/`));
  if (!extra) return true;
  const rule = EXTRA_PAGE_RULES[extra];
  return rule === ANY_ADMIN || hasAdminModule(permissions, rule);
};

/** Where to send an admin who opens a page they cannot use: their first sidebar page, else their profile. */
const homeHref = (permissions: AdminPermissionList): string =>
  visibleGroups(permissions)[0]?.items[0]?.href ?? "/admin/profile";

export const adminNavigation = { groups, visibleGroups, isAllowed, countFor, groupCount, findByPath, canOpen, homeHref };
