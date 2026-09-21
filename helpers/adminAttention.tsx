import type { LucideIcon } from "lucide-react";
import {
  Clock,
  ArrowDownToLine,
  Landmark,
  LifeBuoy,
  CalendarCheck,
  PhoneCall,
  MessageSquare,
  Inbox,
  Trophy,
  ClipboardCheck,
  MessageCircle,
  CreditCard,
  Sparkles,
} from "lucide-react";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminNavigation, type AdminPermissionList } from "./adminNavigation";
import { hasAdminModule } from "./adminPermissions";
import { adminFormat } from "./adminFormat";

export type AttentionTone = "money" | "verify" | "inbox" | "sales" | "content" | "system";

export type AttentionTile = {
  key: keyof AttentionCounts;
  count: number;
  /** Noun phrase that follows the count, already pluralised. */
  title: string;
  /** One short line under the title. */
  detail: string;
  /** Lands on the list already narrowed to exactly the rows counted. */
  href: string;
  icon: LucideIcon;
  tone: AttentionTone;
  /** The stuck-orders queue has a one-click fix for admins with Transactions access. */
  canReconcile?: boolean;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Every work queue an admin can act on, in the order it should be looked at:
 * money first, then verifications, then people waiting on a reply. Zero
 * counts are dropped, and queues that live on a page the admin cannot open are
 * dropped too.
 */
const tiles = (attention: AttentionCounts, permissions: AdminPermissionList): AttentionTile[] => {
  const all: AttentionTile[] = [
    {
      key: "staleOrders",
      count: attention.staleOrders,
      title: plural(attention.staleOrders, "order stuck pending", "orders stuck pending"),
      detail: "older than an hour",
      href: "/admin/transactions?status=pending&filter=stale-pending",
      icon: Clock,
      tone: "money",
      canReconcile: hasAdminModule(permissions, ["transactions"]),
    },
    {
      key: "teacherWithdrawals",
      count: attention.teacherWithdrawals,
      title: plural(attention.teacherWithdrawals, "teacher withdrawal", "teacher withdrawals"),
      detail: `${adminFormat.inr(attention.teacherWithdrawalsAmount)} to pay out`,
      href: "/admin/teachers/withdrawals?status=pending",
      icon: ArrowDownToLine,
      tone: "money",
    },
    {
      key: "studentWithdrawals",
      count: attention.studentWithdrawals,
      title: plural(attention.studentWithdrawals, "student withdrawal", "student withdrawals"),
      detail: `${adminFormat.inr(attention.studentWithdrawalsAmount)} to pay out`,
      href: "/admin/students/withdrawals?status=pending",
      icon: ArrowDownToLine,
      tone: "money",
    },
    {
      key: "teacherBankPending",
      count: attention.teacherBankPending,
      title: plural(attention.teacherBankPending, "teacher bank detail", "teacher bank details"),
      detail: "to verify",
      href: "/admin/teachers/bank-details?status=pending",
      icon: Landmark,
      tone: "verify",
    },
    {
      key: "studentBankPending",
      count: attention.studentBankPending,
      title: plural(attention.studentBankPending, "student bank detail", "student bank details"),
      detail: "to verify",
      href: "/admin/students/bank-details?status=pending",
      icon: Landmark,
      tone: "verify",
    },
    {
      key: "supportUnread",
      count: attention.supportUnread,
      title: plural(attention.supportUnread, "support thread", "support threads"),
      detail: `unread of ${attention.supportOpen} open`,
      href: "/admin/support?status=open&filter=unread",
      icon: LifeBuoy,
      tone: "inbox",
    },
    {
      key: "demoRequestsNew",
      count: attention.demoRequestsNew,
      title: plural(attention.demoRequestsNew, "demo request", "demo requests"),
      detail: "still marked new",
      href: "/admin/sales?stage=new&source=demo_request",
      icon: CalendarCheck,
      tone: "sales",
    },
    {
      key: "followupsOverdue",
      count: attention.followupsOverdue,
      title: plural(attention.followupsOverdue, "follow-up", "follow-ups"),
      detail: "overdue",
      href: "/admin/sales?filter=overdue",
      icon: PhoneCall,
      tone: "sales",
    },
    {
      key: "inquiriesPending",
      count: attention.inquiriesPending,
      title: plural(attention.inquiriesPending, "teacher inquiry", "teacher inquiries"),
      detail: "waiting for a reply",
      href: "/admin/teachers/inquiries?status=pending",
      icon: MessageSquare,
      tone: "inbox",
    },
    {
      key: "contactNew",
      count: attention.contactNew,
      title: plural(attention.contactNew, "contact message", "contact messages"),
      detail: "unread",
      href: "/admin/contact-submissions?status=new",
      icon: Inbox,
      tone: "inbox",
    },
    {
      key: "prizesUndistributed",
      count: attention.prizesUndistributed,
      title: plural(attention.prizesUndistributed, "live test", "live tests"),
      detail: "with prizes to distribute",
      href: "/admin/live-tests?filter=prizes-pending",
      icon: Trophy,
      tone: "content",
    },
    {
      key: "reviewsPending",
      count: attention.reviewsPending,
      title: plural(attention.reviewsPending, "content review", "content reviews"),
      detail: "pending",
      href: "/admin/content-reviews?status=pending",
      icon: ClipboardCheck,
      tone: "content",
    },
    {
      key: "blogCommentsPending",
      count: attention.blogCommentsPending,
      title: plural(attention.blogCommentsPending, "blog comment", "blog comments"),
      detail: "to moderate",
      href: "/admin/blog/comments?status=pending",
      icon: MessageCircle,
      tone: "content",
    },
    {
      key: "subscriptionsExpiring7d",
      count: attention.subscriptionsExpiring7d,
      title: plural(attention.subscriptionsExpiring7d, "subscription", "subscriptions"),
      detail: "expiring this week",
      href: "/admin/subscriptions?filter=expiring-7d",
      icon: CreditCard,
      tone: "system",
    },
    {
      key: "aiFailed7d",
      count: attention.aiFailed7d,
      title: plural(attention.aiFailed7d, "AI generation", "AI generations"),
      detail: "failed this week",
      href: "/admin/ai-usage?status=failed&filter=last-7d",
      icon: Sparkles,
      tone: "system",
    },
  ];

  return all.filter((tile) => tile.count > 0 && adminNavigation.canOpen(tile.href, permissions));
};

const total = (attention: AttentionCounts, permissions: AdminPermissionList): number =>
  tiles(attention, permissions).reduce((sum, tile) => sum + tile.count, 0);

export const adminAttention = { tiles, total };
