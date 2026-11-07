import React from "react";
import { ArrowDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { useSubscriptionStatusQuery } from "../helpers/useTeacherSubscription";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import styles from "./CurrentSubscriptionStatus.module.css";

interface CurrentSubscriptionStatusProps {
  statusQuery: ReturnType<typeof useSubscriptionStatusQuery>;
  paymentMode: "normal" | "recurring";
  // Recurring mode only: the teacher's autopay mandate is live.
  autopayActive: boolean;
  // There is a plan above the current one, so the plan list below has something to show.
  hasHigherPlan: boolean;
  // A paid plan whose autopay was cancelled can be bought again to restart it.
  canRestartAutopay: boolean;
  isStartingPayment: boolean;
  isCancelling: boolean;
  onViewPlans: () => void;
  onRestartAutopay: () => void;
  onCancel: () => void;
}

const formatDate = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

const formatNumber = (value: number) =>
  (Math.round(value * 100) / 100).toLocaleString("en-IN");

const shortPlanName = (name: string) => name.replace(/\s+plan$/i, "");

const FeeSplit: React.FC<{ fee: number; savings: number }> = ({ fee, savings }) => {
  const keep = Math.max(0, 100 - fee);
  return (
    <div className={styles.feeCard}>
      <div className={styles.feeTop}>
        <span className={styles.feeLabel}>Platform fee</span>
        {savings > 0 && (
          <span className={styles.savingsPill}>{formatNumber(savings)}% below standard</span>
        )}
      </div>
      <span className={styles.feeValue}>{formatNumber(fee)}%</span>
      <div className={styles.splitBar} aria-hidden>
        <span className={styles.splitKeep} style={{ flexGrow: keep }} />
        <span className={styles.splitFee} style={{ flexGrow: fee }} />
      </div>
      <dl className={styles.splitLegend}>
        <div>
          <dt>
            <span className={`${styles.dot} ${styles.dotKeep}`} aria-hidden /> You keep
          </dt>
          <dd>₹{formatNumber(keep)}</dd>
        </div>
        <div>
          <dt>
            <span className={`${styles.dot} ${styles.dotFee}`} aria-hidden /> Fee
          </dt>
          <dd>₹{formatNumber(fee)}</dd>
        </div>
      </dl>
      <p className={styles.feeFoot}>
        On every ₹100 sale. Past sales keep the rate they were sold at.
      </p>
    </div>
  );
};

export const CurrentSubscriptionStatus: React.FC<CurrentSubscriptionStatusProps> = ({
  statusQuery,
  paymentMode,
  autopayActive,
  hasHigherPlan,
  canRestartAutopay,
  isStartingPayment,
  isCancelling,
  onViewPlans,
  onRestartAutopay,
  onCancel,
}) => {
  const subscription = statusQuery.data;

  if (statusQuery.isPending) {
    return (
      <section className={styles.hero} aria-label="Your plan" aria-busy="true">
        <div className={`${styles.card} ${styles.loadingCard}`}>
          <div className={styles.content}>
            <Skeleton style={{ height: "1.25rem", width: "6rem" }} />
            <Skeleton style={{ height: "2.25rem", width: "12rem" }} />
            <Skeleton style={{ height: "1rem", width: "70%" }} />
            <Skeleton style={{ height: "3rem", width: "100%" }} />
          </div>
          <Skeleton style={{ height: "13rem", width: "100%", borderRadius: "1.25rem" }} />
        </div>
      </section>
    );
  }

  if (statusQuery.isError && !subscription) {
    return (
      <section className={styles.hero} aria-label="Your plan">
        <div className={styles.errorCard}>
          <p>We could not load your plan right now.</p>
          <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const fee = subscription?.platformFeePercentage ?? DEFAULT_TEACHER_PLATFORM_FEE;
  const savings = DEFAULT_TEACHER_PLATFORM_FEE - fee;
  const isPaid = !!subscription && subscription.planPrice > 0;
  const isActive = subscription?.status === "active";
  // In Recurring mode only a live mandate renews a plan; a cancelled plan
  // stays active until its end date and then moves to the standard fee.
  const willRenew =
    isPaid && !!subscription?.autoRenew && (paymentMode === "normal" || autopayActive);
  const endDate = formatDate(subscription?.endDate);
  const hasTrialRate =
    subscription?.platformFeeOverride !== null && subscription?.platformFeeOverride !== undefined;
  const hasSpecialRate = !!subscription && (subscription.hasAccountFeeOverride || hasTrialRate);

  const title = isPaid ? shortPlanName(subscription!.planName) : "Free";

  let statusLabel: string;
  if (isPaid && isActive && willRenew) statusLabel = "Active";
  else if (isPaid && isActive) statusLabel = endDate ? `Ends ${endDate}` : "Ending";
  else if (isPaid) statusLabel = "Inactive";
  else statusLabel = hasSpecialRate ? "Special rate" : "Standard rate";

  let description: string;
  if (isPaid && willRenew) {
    description = hasHigherPlan
      ? "A lower fee on every sale, a verified badge and more AI questions each day."
      : "You're on our top plan, with the lowest fee and every tool unlocked.";
  } else if (isPaid) {
    description =
      paymentMode === "recurring"
        ? `Autopay is off, so you won't be charged again. You keep this plan until ${endDate ?? "the end of this period"}, then move to the standard ${DEFAULT_TEACHER_PLATFORM_FEE}% fee. Restart autopay to keep it; the new period starts when this one ends.`
        : `This plan won't renew on its own. You keep it until ${endDate ?? "the end of this period"}, then move to the standard ${DEFAULT_TEACHER_PLATFORM_FEE}% fee.`;
  } else if (hasTrialRate && !subscription?.hasAccountFeeOverride && endDate) {
    description = `You have a special ${formatNumber(fee)}% rate until ${endDate}.`;
  } else if (hasSpecialRate) {
    description = `Your account has a special ${formatNumber(fee)}% rate on every sale.`;
  } else {
    description = "Sell tests, courses and notes for free. A paid plan lowers the fee you pay on every sale.";
  }

  const period = (subscription?.planDurationDays ?? 0) > 31 ? "year" : "month";
  const showRestart = isPaid && isActive && canRestartAutopay;
  const showCancel = isPaid && isActive && willRenew;

  return (
    <section className={styles.hero} aria-labelledby="current-plan-title">
      <div className={styles.card}>
        <div className={styles.content}>
          <span className={styles.chip}>Your plan</span>

          <div className={styles.titleRow}>
            <h2 id="current-plan-title" className={styles.title}>
              {title}
              <svg className={styles.underline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
                <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
              </svg>
            </h2>
            <span className={`${styles.statusPill} ${isPaid && isActive && !willRenew ? styles.statusEnding : ""}`}>
              {statusLabel}
            </span>
          </div>

          <p className={styles.description}>{description}</p>

          {isPaid && (
            <dl className={styles.facts}>
              <div className={`${styles.fact} ${styles.factButter}`}>
                <dt>Price</dt>
                <dd>
                  ₹{formatNumber(subscription!.planPrice)}
                  <span className={styles.factUnit}>/{period}</span>
                </dd>
              </div>
              <div className={`${styles.fact} ${styles.factBlue}`}>
                <dt>{willRenew ? "Renews on" : "Ends on"}</dt>
                <dd>{endDate ?? "-"}</dd>
              </div>
              <div className={`${styles.fact} ${styles.factLavender}`}>
                <dt>Payment</dt>
                <dd>
                  {paymentMode === "recurring"
                    ? autopayActive && willRenew
                      ? "Autopay on"
                      : "Autopay off"
                    : "Paid each period"}
                </dd>
              </div>
            </dl>
          )}

          {(hasHigherPlan || showRestart || showCancel) && (
            <div className={styles.actions}>
              {showRestart && (
                <Button
                  className={styles.primaryCta}
                  onClick={onRestartAutopay}
                  disabled={isStartingPayment}
                >
                  {isStartingPayment ? (
                    <Loader2 size={16} className={styles.spinner} aria-hidden />
                  ) : (
                    <RefreshCw size={16} aria-hidden />
                  )}
                  Restart autopay
                </Button>
              )}
              {hasHigherPlan && (
                <Button
                  className={showRestart ? styles.secondaryCta : styles.primaryCta}
                  onClick={onViewPlans}
                >
                  {isPaid ? "Upgrade plan" : "Compare plans"}
                  <ArrowDown size={16} aria-hidden />
                </Button>
              )}
              {showCancel && (
                <Button
                  className={styles.quietCta}
                  onClick={onCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Cancelling..." : "Cancel subscription"}
                </Button>
              )}
            </div>
          )}
        </div>

        <FeeSplit fee={fee} savings={savings} />
      </div>
    </section>
  );
};
