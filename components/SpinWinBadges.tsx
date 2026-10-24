import React from "react";
import { Badge } from "./Badge";
import {
  SPIN_CLAIM_STATUS_LABELS,
  SPIN_COUPON_STATUS_LABELS,
  SPIN_PHASE_LABELS,
  type SpinCampaignPhase,
  type SpinCouponStatus,
} from "../helpers/spinWinRules";

type Variant = React.ComponentProps<typeof Badge>["variant"];

const PHASE_VARIANT: Record<SpinCampaignPhase, Variant> = {
  draft: "outline",
  scheduled: "lavender",
  active: "success",
  paused: "warning",
  completed: "secondary",
  expired: "secondary",
};

const COUPON_VARIANT: Record<SpinCouponStatus, Variant> = {
  active: "success",
  reserved: "lavender",
  redeemed: "default",
  expired: "secondary",
  void: "destructive",
};

const CLAIM_VARIANT: Record<string, Variant> = {
  unclaimed: "warning",
  claimed: "success",
  forfeited: "destructive",
};

export const SpinPhaseBadge = ({ phase }: { phase: SpinCampaignPhase }) => (
  <Badge variant={PHASE_VARIANT[phase]}>{SPIN_PHASE_LABELS[phase]}</Badge>
);

export const SpinCouponBadge = ({ status }: { status: SpinCouponStatus }) => (
  <Badge variant={COUPON_VARIANT[status]}>{SPIN_COUPON_STATUS_LABELS[status]}</Badge>
);

export const SpinClaimBadge = ({ status }: { status: string }) => (
  <Badge variant={CLAIM_VARIANT[status] ?? "outline"}>{SPIN_CLAIM_STATUS_LABELS[status] ?? status}</Badge>
);