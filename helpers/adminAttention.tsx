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
  UserCheck,
  MessageCircle,
  Flag,
} from "lucide-react";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminNavigation, type AdminPermissionList } from "./adminNavigation";
import { hasAdminModule } from "./adminPermissions";

export type AttentionTone = "money" | "verify" | "inbox" | "sales" | "content";

export type AttentionTile = {
  key: keyof AttentionCounts;
  count: number;
  /** Noun phrase that follows the count, already pluralised and readable on its own. */
  title: string;
  /** Lands on the list already narrowed to exactly the rows counted. */
  href: string;
  icon: LucideIcon;
  tone: AttentionTone;
  /** The stuck-orders queue has a one-click fix for admins with Transactions access. */
  canReconcile?: boolean;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Every work queue an admin has to act on, in the order it should be looked at:
 * money first, then verifications, then people waiting on a reply. Zero
 * counts are dropped, and queues that live on a page the admin cannot open are
 * dropped too. Informational counts (expiring subscriptions, failed AI runs)
 * are not queues and stay off this list.
 */
const tiles = (attention: AttentionCounts, permissions: AdminPermissionList): AttentionTile[] => {
  const reviews = attention.reviewsPending + attention.reviewsSenior;
  const all: AttentionTile[] = [
    {
      key: "staleOrders",
      count: attention.staleOrders,
      title: plural(attention.staleOrders, "order stuck pending", "orders stuck pending"),
      href: "/admin/transactions?status=pending&filter=stale-pending",
      icon: Clock,
      tone: "money",
      canReconcile: hasAdminModule(permissions, ["transactions"]),
    },
    {
      key: "teacherWithdrawals",
      count: attention.teacherWithdrawals,
      title: plural(attention.teacherWithdrawals, "teacher withdrawal to pay", "teacher withdrawals to pay"),
      href: "/admin/teachers/withdrawals?status=pending",
      icon: ArrowDownToLine,
      tone: "money",
    },
    {
      key: "studentWithdrawals",
      count: attention.studentWithdrawals,
      title: plural(attention.studentWithdrawals, "student withdrawal to pay", "student withdrawals to pay"),
      href: "/admin/students/withdrawals?status=pending",
      icon: ArrowDownToLine,
      tone: "money",
    },
    {
      key: "teacherBankPending",
      count: attention.teacherBankPending,
      title: plural(attention.teacherBankPending, "teacher bank detail to verify", "teacher bank details to verify"),
      href: "/admin/teachers/bank-details?status=pending",
      icon: Landmark,
      tone: "verify",
    },
    {
      key: "studentBankPending",
      count: attention.studentBankPending,
      title: plural(attention.studentBankPending, "student bank detail to verify", "student bank details to verify"),
      href: "/admin/students/bank-details?status=pending",
      icon: Landmark,
      tone: "verify",
    },
    {
      key: "supportUnread",
      count: attention.supportUnread,
      title: plural(attention.supportUnread, "unread support thread", "unread support threads"),
      href: "/admin/support?status=open&filter=unread",
      icon: LifeBuoy,
      tone: "inbox",
    },
    {
      key: "demoRequestsNew",
      count: attention.demoRequestsNew,
      title: plural(attention.demoRequestsNew, "new demo request", "new demo requests"),
      href: "/admin/sales?stage=new&source=demo_request",
      icon: CalendarCheck,
      tone: "sales",
    },
    {
      key: "followupsOverdue",
      count: attention.followupsOverdue,
      title: plural(attention.followupsOverdue, "overdue follow-up", "overdue follow-ups"),
      href: "/admin/sales?filter=overdue",
      icon: PhoneCall,
      tone: "sales",
    },
    {
      key: "inquiriesPending",
      count: attention.inquiriesPending,
      title: plural(attention.inquiriesPending, "teacher inquiry to answer", "teacher inquiries to answer"),
      href: "/admin/teachers/inquiries?status=pending",
      icon: MessageSquare,
      tone: "inbox",
    },
    {
      key: "liveTeachingPending",
      count: attention.liveTeachingPending,
      title: plural(attention.liveTeachingPending, "live teaching application", "live teaching applications"),
      href: "/admin/teachers/live-teaching",
      icon: UserCheck,
      tone: "verify",
    },
    {
      key: "contactNew",
      count: attention.contactNew,
      title: plural(attention.contactNew, "unread contact message", "unread contact messages"),
      href: "/admin/contact-submissions?status=new",
      icon: Inbox,
      tone: "inbox",
    },
    {
      key: "prizesUndistributed",
      count: attention.prizesUndistributed,
      title: plural(attention.prizesUndistributed, "live test prize to distribute", "live test prizes to distribute"),
      href: "/admin/live-tests?filter=prizes-pending",
      icon: Trophy,
      tone: "content",
    },
    {
      key: "reviewsPending",
      count: reviews,
      title: plural(reviews, "content review", "content reviews"),
      // Senior approvals are counted in; the list opens on whichever queue holds the work.
      href: attention.reviewsPending > 0 ? "/admin/content-reviews?status=pending" : "/admin/content-reviews?status=senior_review",
      icon: ClipboardCheck,
      tone: "content",
    },
    {
      key: "blogCommentsPending",
      count: attention.blogCommentsPending,
      title: plural(attention.blogCommentsPending, "blog comment to moderate", "blog comments to moderate"),
      href: "/admin/blog/comments?status=pending",
      icon: MessageCircle,
      tone: "content",
    },
    {
      key: "contentReportsNew",
      count: attention.contentReportsNew,
      title: plural(attention.contentReportsNew, "new content report", "new content reports"),
      href: "/admin/content-reports?status=new",
      icon: Flag,
      tone: "content",
    },
  ];

  return all.filter((tile) => tile.count > 0 && adminNavigation.canOpen(tile.href, permissions));
};

const total = (attention: AttentionCounts, permissions: AdminPermissionList): number =>
  tiles(attention, permissions).reduce((sum, tile) => sum + tile.count, 0);

export const adminAttention = { tiles, total };