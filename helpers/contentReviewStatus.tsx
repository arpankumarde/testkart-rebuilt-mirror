/*
 * Review statuses shared by the admin queue and the server. "Pending" and
 * "Senior approval" are both still waiting for a decision: a teammate who cannot
 * decide moves a review to Senior approval and any admin can move it back or
 * approve or reject it. There is no seniority check - it is a hand-off marker.
 * Teachers never see the difference; to them both are "in review", and they can
 * take an item back out of either.
 */

import type { ContentType } from "./schema";

export const OPEN_REVIEW_STATUSES = ["pending", "senior_review"] as const;

/** An item's latest review when an admin rejected it: the note sent to the teacher. */
export type ContentRejection = {
  reason: string | null;
  rejectedAt: Date | null;
};

/* How teacher-facing copy names each reviewable content type. */
export const CONTENT_NOUNS: Record<ContentType, string> = {
  mock_test: "test series",
  course: "course",
  digital_product: "study note",
  course_bundle: "bundle",
  live_test: "live test",
};

export const isOpenReview = (status: string): boolean =>
  (OPEN_REVIEW_STATUSES as readonly string[]).includes(status);

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  senior_review: "Senior approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const reviewStatusLabel = (status: string): string =>
  STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

export const reviewStatusBadgeVariant = (
  status: string
): "warning" | "secondary" | "success" | "destructive" | "outline" => {
  switch (status) {
    case "pending":
      return "warning";
    case "senior_review":
      return "secondary";
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
};
