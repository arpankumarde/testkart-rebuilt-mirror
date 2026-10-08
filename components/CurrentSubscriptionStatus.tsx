import React from "react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Crown,
  XCircle,
  Zap,
  Shield,
} from "lucide-react";
import { useSubscriptionStatusQuery } from "../helpers/useTeacherSubscription";
import { useMandateStatusQuery } from "../helpers/useRecurringPayment";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import styles from "./CurrentSubscriptionStatus.module.css";

interface CurrentSubscriptionStatusProps {
  statusQuery: ReturnType<typeof useSubscriptionStatusQuery>;
  mandateQuery: ReturnType<typeof useMandateStatusQuery>;
  paymentMode: "normal" | "recurring";
  onCancel: () => void;
  isCancelling: boolean;
}

export const CurrentSubscriptionStatus: React.FC<
  CurrentSubscriptionStatusProps
> = ({
  statusQuery,
  mandateQuery,
  paymentMode,
  onCancel,
  isCancelling,
}) => {
  const subscription = statusQuery.data;
  const mandate = mandateQuery.data;
  const mandateIsActive = mandate?.mandateStatus === 'active';

  if (statusQuery.isFetching) {
    return (
      <section>
        <h2 className={styles.sectionHeading}>Your platform fee</h2>
        <div className={styles.statusCard}>
          <Skeleton style={{ height: "24px", width: "150px" }} />
          <Skeleton
            style={{ height: "20px", width: "200px", marginTop: "8px" }}
          />
          <Skeleton
            style={{ height: "20px", width: "180px", marginTop: "8px" }}
          />
          <Skeleton
            style={{ height: "40px", width: "120px", marginTop: "16px" }}
          />
        </div>
      </section>
    );
  }

  if (statusQuery.isError) {
    return (
      <section>
        <h2 className={styles.sectionHeading}>Your platform fee</h2>
        <div className={styles.statusCard}>
          <p className={styles.errorText}>Could not load your platform fee.</p>
        </div>
      </section>
    );
  }

  // Plans are no longer sold (13-10-2026), so a teacher without one sees their fee only.
  if (!subscription) {
    return (
      <section>
        <h2 className={styles.sectionHeading}>Your platform fee</h2>
        <div className={styles.statusCard}>
          {/* <div className={styles.noSubIcon}>
            <AlertTriangle size={48} />
          </div>
          <h3>No Active Subscription</h3>
          <p>Choose a plan below to start monetizing your content!</p> */}
          <div className={styles.statusDetails}>
            <div className={`${styles.platformFeeBox} ${styles.feeDefault}`}>
              <Shield size={18} />
              <div>
                <div className={styles.feeLabel}>Your Platform Fee</div>
                <div className={styles.feeValue}>{DEFAULT_TEACHER_PLATFORM_FEE}%</div>
              </div>
            </div>
          </div>
          <div className={styles.freeNote}>
            <p>
              This fee is taken from each sale. Past sales keep the rate they were sold at.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const isActive = subscription.status === "active";
  // In Recurring mode only a live mandate renews a plan; a cancelled plan
  // stays active until its end date and then moves to the standard fee.
  const willRenew =
    !!subscription.autoRenew && (paymentMode === "normal" || mandateIsActive);
  const endDate = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";
  
  const isFree = subscription.planPrice === 0;
  const hasSpecialRate =
    subscription.platformFeeOverride !== null && subscription.platformFeeOverride !== undefined;

  const feeColorClass = 
    !subscription.planPrice || subscription.planPrice === 0 ? styles.feeDefault :
    (statusQuery.data as any).platformFeePercentage >= 30 ? styles.feeHigh :
    (statusQuery.data as any).platformFeePercentage >= 20 ? styles.feeMedium :
    styles.feeLow;

  return (
    <section>
      <h2 className={styles.sectionHeading}>{isFree ? "Your platform fee" : "Current Subscription"}</h2>
      <div className={`${styles.statusCard} ${isActive ? styles.active : ""}`}>
        {isFree ? (
          <div className={styles.statusHeader}>
            <h3 className={styles.planName}>{hasSpecialRate ? "Special rate" : "Standard rate"}</h3>
          </div>
        ) : (
        <div className={styles.statusHeader}>
          <div>
            <h3 className={styles.planName}>
              {subscription.planName}
            </h3>
            {isActive && willRenew && (
              <Badge variant="success">
                <CheckCircle size={14} /> Active
              </Badge>
            )}
            {isActive && !willRenew && (
              <Badge variant="warning">
                <Clock size={14} /> Ends {endDate}
              </Badge>
            )}
          </div>
          <div className={styles.planPrice}>
            {isFree ? (
              <span className={styles.freeBadge}>Free Forever</span>
            ) : (
              <>
                ₹{subscription.planPrice.toLocaleString("en-IN")}
                <span className={styles.pricePeriod}>
                  /{subscription.planDurationDays > 31 ? "year" : "month"}
                </span>
              </>
            )}
          </div>
        </div>
        )}

        <div className={styles.statusDetails}>
          {(statusQuery.data as any).platformFeePercentage !== undefined && (
            <div className={`${styles.platformFeeBox} ${feeColorClass}`}>
              <Shield size={18} />
              <div>
                <div className={styles.feeLabel}>Your Platform Fee</div>
                <div className={styles.feeValue}>
                  {(statusQuery.data as any).platformFeePercentage}%
                </div>
              </div>
            </div>
          )}
          
          {isFree && hasSpecialRate && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Valid Until:</span>
              <span className={styles.detailValue}>{endDate}</span>
            </div>
          )}

          {!isFree && (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {willRenew ? "Renews On:" : "Valid Until:"}
                </span>
                <span className={styles.detailValue}>{endDate}</span>
              </div>

              {paymentMode === "recurring" && willRenew && (
                <div className={styles.autoRenewBanner}>
                  <Zap size={16} />
                  <span>
                    <strong>Autopay active</strong> - Your subscription will
                    auto-renew
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {!isFree && (
          <div className={styles.statusActions}>
            {isActive && willRenew && (
              <Button
                variant="destructive"
                onClick={onCancel}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Subscription"}
              </Button>
            )}
            {isActive && !willRenew && (
              <p className={styles.cancelledNote}>
                {paymentMode === "recurring"
                  ? `Autopay is off, so you won't be charged again. You keep this plan until ${endDate}, then move to the standard ${DEFAULT_TEACHER_PLATFORM_FEE}% platform fee. To keep it, restart autopay below; the new period starts when this one ends.`
                  : `This plan won't renew on its own. You keep it until ${endDate}, then move to the standard ${DEFAULT_TEACHER_PLATFORM_FEE}% platform fee.`}
              </p>
            )}
          </div>
        )}

        {isFree && (
          <div className={styles.freeNote}>
            <p>
              {/* You're on the Free Plan. Upgrade to a paid plan to enjoy lower platform fees and unlock premium features! */}
              This fee is taken from each sale. Past sales keep the rate they were sold at.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};