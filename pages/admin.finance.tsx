import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useAdminFinanceSummaryQuery } from "../helpers/useAdminFinance";
import { PeriodType } from "../endpoints/admin/finance/summary_GET.schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { DatePicker } from "../components/DatePicker";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import {
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  RefreshCw,
  Crown,
  Receipt,
  Users,
  BookOpen,
  MonitorPlay,
  FileText,
  Package,
  Trophy
} from "lucide-react";
import styles from "./admin.finance.module.css";

const StatCard = ({
  title,
  value,
  icon,
  subValue,
  subLabel,
  isLoading,
  variant = "default",
  badge
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
  subLabel?: string;
  isLoading?: boolean;
  variant?: "default" | "highlight" | "warning";
  badge?: string;
}) => (
  <div className={`${styles.statCard} ${styles[variant]}`}>
    {isLoading ? (
      <>
        <div className={styles.statHeader}>
          <Skeleton style={{ height: "1rem", width: "100px" }} />
          <Skeleton style={{ height: "2rem", width: "2rem", borderRadius: "50%" }} />
        </div>
        <Skeleton style={{ height: "2.5rem", width: "150px", margin: "var(--spacing-4) 0" }} />
        <Skeleton style={{ height: "1rem", width: "80%" }} />
      </>
    ) : (
      <>
        <div className={styles.statHeader}>
          <div className={styles.titleWrapper}>
            <h3 className={styles.statTitle}>{title}</h3>
            {badge && <Badge variant="outline" className={styles.badge}>{badge}</Badge>}
          </div>
          <div className={styles.statIcon}>{icon}</div>
        </div>
        <p className={styles.statValue}>{value}</p>
        {subValue || subLabel ? (
          <p className={styles.statSub}>
            {subValue && <span className={styles.statSubValue}>{subValue}</span>} {subLabel}
          </p>
        ) : null}
      </>
    )}
  </div>
);

const AdminFinancePage: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data, isFetching, isError, error } = useAdminFinanceSummaryQuery({
    period,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
  });

  /* Whole rupees. maximumFractionDigits alone gave one card ₹80,427.35 and the
     next ₹18,254.7, so the column of figures never lined up. */
  const formatCurrency = (amount: number) => {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  const productRevenueSum = data ? (
    data.regularMockTestRevenue +
    data.liveTestRevenue +
    data.courseRevenue + 
    data.digitalProductRevenue + 
    data.otherRevenue +
    data.sponsoredRevenue
  ) : 0;

  return (
    <>
      <Helmet>
        <title>Finance overview - Testkart Admin</title>
        <meta name="description" content="Revenue, fees and payouts across Testkart." />
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="Finance overview">
          <div className={styles.filters}>
            <div className={styles.periodSelect}>
              <Select 
                value={period} 
                onValueChange={(val) => setPeriod(val as PeriodType)}
              >
                <SelectTrigger className={styles.selectTrigger}>
                  <CalendarIcon size={16} className={styles.selectIcon} />
                  <SelectValue placeholder="Pick a period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This week</SelectItem>
                  <SelectItem value="last_week">Last week</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                  <SelectItem value="this_quarter">This quarter</SelectItem>
                  <SelectItem value="last_quarter">Last quarter</SelectItem>
                  <SelectItem value="this_year">This year</SelectItem>
                  <SelectItem value="last_year">Last year</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <div className={styles.dateRange}>
                <DatePicker value={startDate} onChange={setStartDate} />
                <span className={styles.dateSeparator}>to</span>
                <DatePicker value={endDate} onChange={setEndDate} />
              </div>
            )}
          </div>
        </ConsolePageHeader>

        {isError && (
          <div className={styles.errorNotice} role="alert">
            <AlertCircle size={20} />
            <p>The finance figures could not be loaded. {error instanceof Error ? error.message : "Try again in a moment."}</p>
          </div>
        )}

        {/* Revenue Summary Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Revenue</h2>
          <div className={styles.grid}>
            <StatCard
              title="Money in"
              value={data ? formatCurrency(data.totalRevenue + data.sponsoredRevenue + data.subscriptionRevenue) : "₹0"}
              icon={<DollarSign size={18} />}
              subLabel="Sales, sponsorships and subscriptions"
              isLoading={isFetching}
              variant="highlight"
            />

            <StatCard
              title="Testkart keeps"
              value={data ? formatCurrency(data.totalPlatformFee + data.sponsoredRevenue + data.subscriptionRevenue) : "₹0"}
              icon={<TrendingUp size={18} />}
              subLabel="After the teacher share"
              isLoading={isFetching}
              variant="highlight"
            />
            
            <StatCard
              title="Platform fees"
              value={data ? formatCurrency(data.totalPlatformFee) : "₹0"}
              icon={<TrendingUp size={18} />}
              subLabel="Our cut of teacher sales"
              isLoading={isFetching}
            />

            <StatCard
              title="Subscription revenue"
              value={data ? formatCurrency(data.subscriptionRevenue) : "₹0"}
              icon={<RefreshCw size={18} />}
              subValue={data ? data.activePaidSubscriptionsCount.toString() : "0"}
              subLabel={`active paid, ${data?.totalSubscriptionsCount || 0} in total`}
              isLoading={isFetching}
            />
          </div>
        </section>

        {/* Revenue Breakdown by Product Type */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Revenue by product</h2>
          <div className={styles.grid4}>
            <StatCard
              title="Mock tests"
              value={data ? formatCurrency(data.regularMockTestRevenue) : "₹0"}
              icon={<FileText size={18} />}
              subValue={data ? `${getPercentage(data.regularMockTestRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
            <StatCard
              title="Live tests"
              value={data ? formatCurrency(data.liveTestRevenue) : "₹0"}
              icon={<Trophy size={18} />}
              subValue={data ? `${getPercentage(data.liveTestRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
            <StatCard
              title="Courses"
              value={data ? formatCurrency(data.courseRevenue) : "₹0"}
              icon={<MonitorPlay size={18} />}
              subValue={data ? `${getPercentage(data.courseRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
            <StatCard
              title="Study notes"
              value={data ? formatCurrency(data.digitalProductRevenue) : "₹0"}
              icon={<BookOpen size={18} />}
              subValue={data ? `${getPercentage(data.digitalProductRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
            <StatCard
              title="Other"
              value={data ? formatCurrency(data.otherRevenue) : "₹0"}
              icon={<Package size={18} />}
              subValue={data ? `${getPercentage(data.otherRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
            <StatCard
              title="Sponsorships"
              value={data ? formatCurrency(data.sponsoredRevenue) : "₹0"}
              icon={<Users size={18} />}
              subValue={data ? `${getPercentage(data.sponsoredRevenue, productRevenueSum)}%` : "0%"}
              subLabel="of order revenue"
              isLoading={isFetching}
            />
          </div>
        </section>

        {/* Teacher Payouts Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Teacher payouts</h2>
          <div className={styles.grid}>
            <StatCard
              title="Wallet balance"
              value={data ? formatCurrency(data.totalTeacherWalletBalance) : "₹0"}
              icon={<Wallet size={18} />}
              subLabel="What we owe teachers"
              badge="All time"
              isLoading={isFetching}
            />

            <StatCard
              title="Pending withdrawals"
              value={data ? formatCurrency(data.totalPendingWithdrawals) : "₹0"}
              icon={<Clock size={18} />}
              subLabel="Waiting on approval"
              badge="All time"
              isLoading={isFetching}
              variant="warning"
            />
          </div>
        </section>

        {/* Student Wallet Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Student wallets</h2>
          <div className={styles.grid}>
            <StatCard
              title="Wallet balance"
              value={data ? formatCurrency(data.studentWalletBalance) : "₹0"}
              icon={<Users size={18} />}
              subLabel="What we owe students"
              badge="All time"
              isLoading={isFetching}
            />
            <StatCard
              title="Pending withdrawals"
              value={data ? formatCurrency(data.studentPendingWithdrawals) : "₹0"}
              icon={<Clock size={18} />}
              subLabel="Waiting on approval"
              badge="All time"
              isLoading={isFetching}
            />
          </div>
        </section>

        {/* Subscription Details Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscriptions and earnings</h2>
          <div className={styles.grid}>
            <StatCard
              title="Active paid plans"
              value={data ? data.activePaidSubscriptionsCount.toString() : "0"}
              icon={<Crown size={18} />}
              subLabel="Running right now"
              badge="All time"
              isLoading={isFetching}
            />

            <StatCard
              title="Subscription payments"
              value={data ? data.subscriptionTransactionsCount.toString() : "0"}
              icon={<Receipt size={18} />}
              subValue={data ? data.failedSubscriptionTransactionsCount.toString() : "0"}
              subLabel="failed in this period"
              isLoading={isFetching}
            />

            <StatCard
              title="Teacher earnings"
              value={data ? formatCurrency(data.totalTeacherEarnings) : "₹0"}
              icon={<CreditCard size={18} />}
              subLabel="Before withdrawals"
              isLoading={isFetching}
            />
          </div>
        </section>

        <div className={styles.note}>
          <p>
            Revenue, fees and earnings follow the period you picked. Cards marked "All time" always show
            today's position, whatever the period: wallet balances, pending withdrawals and active plans.
          </p>
        </div>
      </div>
    </>
  );
};

export default AdminFinancePage;