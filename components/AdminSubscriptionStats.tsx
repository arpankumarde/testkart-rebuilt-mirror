import { Users, UserCheck, UserX, XCircle, Crown } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { SubscriptionStats } from "../endpoints/admin/subscriptions/list_GET.schema";
import styles from "./AdminSubscriptionStats.module.css";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

const StatCard = ({ icon, label, value, colorClass }: StatCardProps) => (
  <div className={`${styles.statCard} ${colorClass}`}>
    <div className={styles.statCardIcon}>{icon}</div>
    <div className={styles.statCardContent}>
      <span className={styles.statCardLabel}>{label}</span>
      <span className={styles.statCardValue}>{value.toLocaleString("en-IN")}</span>
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className={styles.statCard}>
    <Skeleton style={{ width: "2.5rem", height: "2.5rem", borderRadius: "var(--radius-md)" }} />
    <div className={styles.statCardContent}>
      <Skeleton style={{ width: "100px", height: "0.875rem" }} />
      <Skeleton style={{ width: "60px", height: "1.5rem", marginTop: "var(--spacing-1)" }} />
    </div>
  </div>
);

const PlanCard = ({
  planName,
  activeCount,
  totalCount,
}: {
  planName: string;
  activeCount: number;
  totalCount: number;
}) => (
  <div className={styles.planCard}>
    <div className={styles.planCardHeader}>
      <Crown size={16} className={styles.planCardIcon} />
      <span className={styles.planCardName}>{planName}</span>
    </div>
    <div className={styles.planCardStats}>
      <div className={styles.planCardStat}>
        <span className={styles.planCardStatValue}>{activeCount.toLocaleString("en-IN")}</span>
        <span className={styles.planCardStatLabel}>Active</span>
      </div>
      <div className={styles.planCardDivider} />
      <div className={styles.planCardStat}>
        <span className={styles.planCardStatValue}>{totalCount.toLocaleString("en-IN")}</span>
        <span className={styles.planCardStatLabel}>Total</span>
      </div>
    </div>
  </div>
);

interface AdminSubscriptionStatsProps {
  stats: SubscriptionStats | undefined;
  isFetching: boolean;
  className?: string;
}

export const AdminSubscriptionStats = ({
  stats,
  isFetching,
  className,
}: AdminSubscriptionStatsProps) => {
  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <div className={styles.summaryGrid}>
        {isFetching || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<Users size={22} />}
              label="Paid Subscriptions"
              value={stats.totalSubscriptions}
              colorClass={styles.colorDefault}
            />
            <StatCard
              icon={<UserCheck size={22} />}
              label="Active"
              value={stats.activeCount}
              colorClass={styles.colorSuccess}
            />
            <StatCard
              icon={<XCircle size={22} />}
              label="Expired"
              value={stats.expiredCount}
              colorClass={styles.colorWarning}
            />
            <StatCard
              icon={<UserX size={22} />}
              label="Cancelled"
              value={stats.cancelledCount}
              colorClass={styles.colorDestructive}
            />
          </>
        )}
      </div>

      {!isFetching && stats && (
        <p className={styles.freeNote}>
          {stats.freeTeachersCount.toLocaleString("en-IN")} teacher{stats.freeTeachersCount !== 1 ? "s" : ""} on Free Plan
        </p>
      )}

      {(isFetching || (stats && stats.planBreakdown.length > 0)) && (
        <div className={styles.planSection}>
          <h3 className={styles.planSectionTitle}>Plan Breakdown</h3>
          <div className={styles.planGrid}>
            {isFetching || !stats
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.planCard}>
                    <Skeleton style={{ width: "120px", height: "1rem" }} />
                    <Skeleton style={{ width: "80px", height: "1.25rem", marginTop: "var(--spacing-3)" }} />
                  </div>
                ))
              : stats.planBreakdown.map((plan) => (
                  <PlanCard
                    key={plan.planId}
                    planName={plan.planName}
                    activeCount={plan.activeCount}
                    totalCount={plan.totalCount}
                  />
                ))}
          </div>
        </div>
      )}
    </div>
  );
};