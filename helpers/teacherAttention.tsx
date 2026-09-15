import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  Landmark,
  LifeBuoy,
  ClipboardCheck,
  Trophy,
  Radio,
  CreditCard,
} from "lucide-react";
import type { TeacherAttentionCounts } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "./adminFormat";

export type TeacherAttentionTile = {
  key: string;
  count: number;
  /** Noun phrase that follows the count, already pluralised. */
  title: string;
  /** One short line under the title. */
  detail: string;
  /** Lands on exactly the rows the count covers, with the filter named on that page. */
  href: string;
  icon: LucideIcon;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const BANK_COPY: Record<string, { title: string; detail: string }> = {
  missing: {
    title: "bank account missing",
    detail: "add it before you can withdraw",
  },
  pending: {
    title: "bank account in review",
    detail: "withdrawals unlock once it is verified",
  },
  rejected: {
    title: "bank account rejected",
    detail: "fix the details and submit again",
  },
};

/**
 * Every queue a teacher can act on, in the order it should be looked at:
 * money first, then listings blocked from selling, then people waiting on a
 * reply, then what is about to happen. Zero counts are dropped, so a teacher
 * with nothing outstanding sees no band at all instead of a wall of zeroes.
 */
const tiles = (attention: TeacherAttentionCounts): TeacherAttentionTile[] => {
  const bank = BANK_COPY[attention.bankStatus];

  const all: TeacherAttentionTile[] = [
    {
      key: "withdrawals",
      count: attention.withdrawalsPending,
      title: plural(attention.withdrawalsPending, "withdrawal request", "withdrawal requests"),
      detail: `${adminFormat.inr(attention.withdrawalsPendingAmount)} being processed`,
      href: "/teacher/reports?filter=pending-withdrawals",
      icon: ArrowDownToLine,
    },
    {
      key: "bank",
      count: bank ? 1 : 0,
      title: bank?.title ?? "",
      detail: bank?.detail ?? "",
      href: "/teacher/reports",
      icon: Landmark,
    },
    {
      key: "support",
      count: attention.supportUnread,
      title: plural(attention.supportUnread, "support thread", "support threads"),
      detail: "has a new reply from us",
      href: "/teacher/support?filter=unread",
      icon: LifeBuoy,
    },
    {
      key: "reviewsTests",
      count: attention.reviewsPendingTests,
      title: plural(attention.reviewsPendingTests, "test series", "test series"),
      detail: "waiting on approval to go live",
      href: "/teacher/test-series",
      icon: ClipboardCheck,
    },
    {
      key: "reviewsCourses",
      count: attention.reviewsPendingCourses,
      title: plural(attention.reviewsPendingCourses, "course", "courses"),
      detail: "waiting on approval to go live",
      href: "/teacher/courses",
      icon: ClipboardCheck,
    },
    {
      key: "reviewsProducts",
      count: attention.reviewsPendingProducts,
      title: plural(attention.reviewsPendingProducts, "study note", "study notes"),
      detail: "waiting on approval to go live",
      href: "/teacher/products",
      icon: ClipboardCheck,
    },
    {
      key: "reviewsBundles",
      count: attention.reviewsPendingBundles,
      title: plural(attention.reviewsPendingBundles, "bundle", "bundles"),
      detail: "waiting on approval to go live",
      href: "/teacher/bundles",
      icon: ClipboardCheck,
    },
    {
      key: "reviewsLiveTests",
      count: attention.reviewsPendingLiveTests,
      title: plural(attention.reviewsPendingLiveTests, "live test", "live tests"),
      detail: "waiting on approval to go live",
      href: "/teacher/live-tests",
      icon: ClipboardCheck,
    },
    {
      key: "prizes",
      count: attention.prizesUndistributed,
      title: plural(attention.prizesUndistributed, "live test", "live tests"),
      detail: "ended with prizes still to hand out",
      href: "/teacher/live-tests?filter=prizes-pending",
      icon: Trophy,
    },
    {
      key: "liveSoon",
      count: attention.liveTestsSoon,
      title: plural(attention.liveTestsSoon, "live test", "live tests"),
      detail: "starting within a week",
      href: "/teacher/live-tests?filter=starting-soon",
      icon: Radio,
    },
    {
      key: "subscription",
      count: attention.subscriptionExpiring,
      title: plural(attention.subscriptionExpiring, "subscription", "subscriptions"),
      detail: "expiring this week",
      href: "/teacher/subscription",
      icon: CreditCard,
    },
  ];

  return all.filter((tile) => tile.count > 0);
};

const total = (attention: TeacherAttentionCounts): number =>
  tiles(attention).reduce((sum, tile) => sum + tile.count, 0);

export const teacherAttention = { tiles, total };
