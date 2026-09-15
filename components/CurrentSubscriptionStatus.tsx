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
import styles from "./CurrentSubscriptionStatus.module.css";

interface CurrentSubscriptionStatusProps {
  statusQuery: ReturnType<typeof useSubscriptionStatusQuery>;
  mandateQuery: ReturnType<typeof useMandateStatusQuery>;
  onCancel: () => void;
  onCancelMandate: () => void;
  isCancelling: boolean;
  isCancellingMandate: boolean;
}

export const CurrentSubscriptionStatus: React.FC<
  CurrentSubscriptionStatusProps
> = ({
  statusQuery,
  mandateQuery,
  onCancel,
  onCancelMandate,
  isCancelling,
  isCancellingMandate,
}) => {
  const subscription = statusQuery.data;
  const mandate = mandateQuery.data;
  const mandateIsActive = mandate?.mandateStatus === 'active';

  if (statusQuery.isFetching) {
    return (
      <section>
        <h2 className={styles.sectionHeading}>Current Subscription</h2>
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
        <h2 className={styles.sectionHeading}>Current Subscription</h2>
        <div className={styles.statusCard}>
          <p className={styles.errorText}>Could not load subscription status.</p>
        </div>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section>
        <h2 className={styles.sectionHeading}>Current Subscription</h2>
        <div className={styles.statusCard}>
          <div className={styles.noSubIcon}>
            <AlertTriangle size={48} />
          </div>
          <h3>No Active Subscription</h3>
          <p>Choose a plan below to start monetizing your content!</p>
        </div>
      </section>
    );
  }

  const isActive = subscription.status === "active";
  const isCancelled = subscription.status === "cancelled";
  const endDate = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";
  
  const isFree = subscription.planPrice === 0;

  const feeColorClass = 
    !subscription.planPrice || subscription.planPrice === 0 ? styles.feeDefault :
    (statusQuery.data as any).platformFeePercentage >= 30 ? styles.feeHigh :
    (statusQuery.data as any).platformFeePercentage >= 20 ? styles.feeMedium :
    styles.feeLow;

  return (
    <section>
      <h2 className={styles.sectionHeading}>Current Subscription</h2>
      <div className={`${styles.statusCard} ${isActive ? styles.active : ""}`}>
        <div className={styles.statusHeader}>
          <div>
            <h3 className={styles.planName}>
              {isFree ? "🆓 " : ""}
              {subscription.planName}
            </h3>
            {isActive && !isCancelled && (
              <Badge variant="success">
                <CheckCircle size={14} /> Active
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="warning">
                <Clock size={14} /> Cancelled
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
          
          {!isFree && (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {isCancelled ? "Valid Until:" : "Renews On:"}
                </span>
                <span className={styles.detailValue}>{endDate}</span>
              </div>

              {mandateIsActive && !isCancelled && (
                <div className={styles.autoRenewBanner}>
                  <Zap size={16} />
                  <span>
                    <strong>UPI Autopay Active</strong> - Your subscription will
                    auto-renew
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {!isFree && (
          <div className={styles.statusActions}>
            {isActive && !isCancelled && (
              <Button
                variant="destructive"
                onClick={onCancel}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Subscription"}
              </Button>
            )}
            {isActive && !isCancelled && mandateIsActive && (
              <Button
                variant="outline"
                onClick={onCancelMandate}
                disabled={isCancellingMandate}
              >
                {isCancellingMandate
                  ? "Cancelling..."
                  : "Cancel Auto-Renewal"}
              </Button>
            )}
            {isCancelled && (
              <p className={styles.cancelledNote}>
                Your subscription will remain active until {endDate}. You can
                resubscribe anytime.
              </p>
            )}
          </div>
        )}

        {isFree && (
          <div className={styles.freeNote}>
            <p>
              You're on the Free Plan. Upgrade to a paid plan to enjoy lower platform fees and unlock premium features!
            </p>
          </div>
        )}
      </div>
    </section>
  );
};