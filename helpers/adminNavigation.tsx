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
import type { AdminRole } from "./AdminTypes";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  allowedRoles?: AdminRole[];
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

const FINANCE: AdminRole[] = ["super_admin", "admin", "billing_manager"];
const CONTENT: AdminRole[] = ["super_admin", "admin", "manager"];
const SITE: AdminRole[] = ["super_admin", "admin"];

const groups: AdminNavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, keywords: "home overview" },
      { href: "/admin/dashboard/old", label: "Dashboard (old)", icon: History, keywords: "legacy previous metrics month" },
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
        allowedRoles: CONTENT,
        countKeys: ["demoRequestsNew", "followupsOverdue"],
        keywords: "leads demo requests follow-ups crm",
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { href: "/admin/finance", label: "Finance overview", icon: PieChart, allowedRoles: FINANCE, keywords: "revenue fees payouts" },
      { href: "/admin/transactions", label: "Transactions", icon: Receipt, allowedRoles: FINANCE, countKeys: ["staleOrders"], keywords: "orders payments payu invoices" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, allowedRoles: FINANCE, countKeys: ["subscriptionsExpiring7d"], keywords: "plans trials mandates" },
      { href: "/admin/teachers/earnings", label: "Teacher earnings", icon: Wallet, allowedRoles: FINANCE, keywords: "wallet balance" },
      { href: "/admin/teachers/withdrawals", label: "Withdrawal requests", icon: ArrowDownToLine, allowedRoles: FINANCE, countKeys: ["teacherWithdrawals"], keywords: "payout teacher" },
      { href: "/admin/teachers/bank-details", label: "Bank details", icon: Landmark, allowedRoles: FINANCE, countKeys: ["teacherBankPending"], keywords: "verify kyc pan teacher" },
      { href: "/admin/students/withdrawals", label: "Student withdrawals", icon: ArrowDownToLine, allowedRoles: FINANCE, countKeys: ["studentWithdrawals"], keywords: "payout prize" },
      { href: "/admin/students/bank-details", label: "Student bank details", icon: Landmark, allowedRoles: FINANCE, countKeys: ["studentBankPending"], keywords: "verify kyc pan" },
    ],
  },
  {
    key: "users",
    label: "Users",
    items: [
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap, allowedRoles: CONTENT, keywords: "impersonate verify" },
      { href: "/admin/students", label: "Students", icon: Users, allowedRoles: CONTENT, keywords: "learners" },
      { href: "/admin/teachers/inquiries", label: "Teacher inquiries", icon: MessageSquare, allowedRoles: CONTENT, countKeys: ["inquiriesPending"], keywords: "institute leads" },
      { href: "/admin/contact-submissions", label: "Contact submissions", icon: Inbox, allowedRoles: CONTENT, countKeys: ["contactNew"], keywords: "messages contact form" },
      { href: "/admin/deleted-accounts", label: "Deleted accounts", icon: UserX, allowedRoles: CONTENT },
      { href: "/admin/support", label: "Support inbox", icon: LifeBuoy, countKeys: ["supportUnread"], keywords: "tickets threads help" },
    ],
  },
  {
    key: "content",
    label: "Catalogue",
    items: [
      { href: "/admin/catalogue", label: "Catalogue dashboard", icon: LayoutDashboard, allowedRoles: CONTENT, keywords: "catalogue overview coverage publishing gaps tests courses notes" },
      { href: "/admin/content-reviews", label: "Content reviews", icon: ClipboardCheck, allowedRoles: CONTENT, countKeys: ["reviewsPending"], keywords: "approve moderation" },
      { href: "/admin/courses", label: "Courses", icon: MonitorPlay, allowedRoles: CONTENT },
      { href: "/admin/notes", label: "Study notes", icon: FileText, allowedRoles: CONTENT, keywords: "digital products pdf" },
      { href: "/admin/test-series", label: "Test series", icon: ListChecks, allowedRoles: CONTENT, keywords: "mock tests" },
      { href: "/admin/live-tests", label: "Live tests", icon: Radio, allowedRoles: CONTENT, countKeys: ["prizesUndistributed"], keywords: "competitions prizes" },
      { href: "/admin/bundles", label: "Bundles", icon: Package, allowedRoles: CONTENT },
    ],
  },
  {
    key: "knowledge",
    label: "Content",
    items: [
      { href: "/admin/content", label: "Content dashboard", icon: LayoutDashboard, end: true, allowedRoles: CONTENT, keywords: "site content seo blog guides pages editorial metadata" },
      { href: "/admin/exam-content", label: "Exam content", icon: Library, allowedRoles: CONTENT, keywords: "exams subjects categories" },
      { href: "/admin/blog", label: "Blog posts", icon: Newspaper, allowedRoles: CONTENT, keywords: "articles seo categories" },
      { href: "/admin/blog/comments", label: "Comments", icon: MessageCircle, allowedRoles: CONTENT, countKeys: ["blogCommentsPending"], keywords: "moderate blog" },
    ],
  },
  {
    key: "site",
    label: "Site",
    items: [
      { href: "/admin/careers", label: "Careers", icon: Briefcase, keywords: "jobs applications" },
      { href: "/admin/news", label: "News & Events", icon: Newspaper, keywords: "press coverage media mentions" },
      { href: "/admin/static-pages", label: "Static pages", icon: Layout, keywords: "terms privacy about" },
      { href: "/admin/email-templates", label: "Email templates", icon: Mail, keywords: "resend notifications" },
      { href: "/admin/api-docs", label: "API docs", icon: FileCode2, keywords: "endpoints reference" },
      { href: "/admin/settings", label: "Settings", icon: Settings, allowedRoles: ["super_admin"], keywords: "admins roles ai provider scripts" },
    ],
  },
  {
    key: "ai",
    label: "AI",
    items: [
      { href: "/admin/ai-questions", label: "AI questions", icon: Sparkles, allowedRoles: SITE, keywords: "generated review export" },
      { href: "/admin/ai-usage", label: "AI usage", icon: Activity, allowedRoles: SITE, countKeys: ["aiFailed7d"], keywords: "logs failures teachers" },
    ],
  },
];

const isAllowed = (item: AdminNavItem, role: AdminRole | null): boolean =>
  !item.allowedRoles || (role !== null && item.allowedRoles.includes(role));

const visibleGroups = (role: AdminRole | null): AdminNavGroup[] =>
  groups
    .map((group) => ({ ...group, items: group.items.filter((item) => isAllowed(item, role)) }))
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
const canOpen = (href: string, role: AdminRole | null): boolean => {
  const item = findByPath(href);
  return item ? isAllowed(item, role) : true;
};

export const adminNavigation = { groups, visibleGroups, isAllowed, countFor, groupCount, findByPath, canOpen };
