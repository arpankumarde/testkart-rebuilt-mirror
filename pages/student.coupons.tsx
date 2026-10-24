import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { BadgeCheck, Gift, PiggyBank, Ticket, TicketPercent } from "lucide-react";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { StudentCouponCard } from "../components/StudentCouponCard";
import { StudentCouponDetailsDialog } from "../components/StudentCouponDetailsDialog";
import { useMySpinCoupons } from "../helpers/useSpinWin";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { couponRupees, studentCouponStatus } from "../helpers/studentCoupons";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import styles from "./student.coupons.module.css";

const TABS = ["all", "available", "redeemed", "expired"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { all: "All", available: "Available", redeemed: "Redeemed", expired: "Expired" };

const inTab = (coupon: MySpinCoupon, tab: Tab) => {
  const status = studentCouponStatus(coupon);
  if (tab === "all") return true;
  if (tab === "available") return status === "available" || status === "pending";
  if (tab === "expired") return status === "expired" || status === "withdrawn";
  return status === "redeemed";
};

const StudentCouponsPage: React.FC = () => {
  const { data, isError, error, refetch, isFetching } = useMySpinCoupons();
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<MySpinCoupon | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cached queries are not refetched on mount here, so pull fresh statuses on arrival.
  useEffect(() => {
    refetch();
  }, [refetch]);

  const coupons = data?.coupons ?? [];
  const counts = Object.fromEntries(TABS.map((t) => [t, coupons.filter((c) => inTab(c, t)).length])) as Record<Tab, number>;
  const savings = coupons.reduce((sum, c) => sum + (studentCouponStatus(c) === "redeemed" ? c.savedAmount ?? 0 : 0), 0);
  const visible = coupons.filter((c) => inTab(c, tab));

  const stats = [
    { label: "Coupons earned", value: String(coupons.length), icon: <Gift size={18} />, tone: styles.peach },
    { label: "Available", value: String(counts.available), icon: <Ticket size={18} />, tone: styles.mint },
    { label: "Redeemed", value: String(counts.redeemed), icon: <BadgeCheck size={18} />, tone: styles.lavender },
    { label: "Total savings", value: couponRupees(savings), icon: <PiggyBank size={18} />, tone: styles.butter },
  ];

  // Roving focus across the filter pills: arrows and Home/End move and select.
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    setTab(TABS[next]);
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>My Coupons | Testkart</title>
        <meta name="description" content="Your Testkart reward coupons, their status and savings." />
      </Helmet>

      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <TicketPercent size={22} />
        </span>
        <div className={styles.headings}>
          <h1 className={styles.title}>My Coupons</h1>
          <p className={styles.subtitle}>Your rewards, ready to make your next purchase more affordable.</p>
        </div>
      </header>

      {isError ? (
        <ConsoleListEmpty tone="error" icon={<Ticket size={20} />} title="Your coupons could not be loaded" description={parseErrorMessage(error)}>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      ) : !data ? (
        <>
          <div className={styles.stats}>
            {stats.map((s) => (
              <Skeleton key={s.label} style={{ height: "5.25rem", borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
          <div className={styles.grid}>
            <Skeleton style={{ height: "17rem", borderRadius: "var(--radius-lg)" }} />
            <Skeleton style={{ height: "17rem", borderRadius: "var(--radius-lg)" }} />
          </div>
        </>
      ) : coupons.length === 0 ? (
        <ConsoleListEmpty
          icon={<Gift size={20} />}
          title="Your rewards are waiting!"
          description="Participate in our campaigns and unlock exciting discounts on your preparation."
        >
          <Button asChild>
            <Link to="/?spin=open">Explore active campaigns</Link>
          </Button>
        </ConsoleListEmpty>
      ) : (
        <>
          <dl className={styles.stats} aria-label="Coupon summary">
            {stats.map((s) => (
              <div key={s.label} className={`${styles.stat} ${s.tone}`}>
                <span className={styles.statIcon} aria-hidden="true">
                  {s.icon}
                </span>
                <div className={styles.statText}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className={styles.tabs} role="tablist" aria-label="Coupon status">
            {TABS.map((t, index) => (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`coupon-list-tab-${t}`}
                aria-controls="coupon-list"
                aria-selected={tab === t}
                tabIndex={tab === t ? 0 : -1}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
                onClick={() => setTab(t)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                {TAB_LABELS[t]}
                <span className={styles.tabCount}>{counts[t]}</span>
              </button>
            ))}
          </div>

          <div id="coupon-list" role="tabpanel" aria-labelledby={`coupon-list-tab-${tab}`} aria-busy={isFetching}>
            {visible.length === 0 ? (
              <ConsoleListEmpty icon={<Ticket size={20} />} title={`No ${TAB_LABELS[tab].toLowerCase()} coupons`} />
            ) : (
              <div className={styles.grid}>
                {visible.map((coupon) => (
                  <StudentCouponCard key={coupon.id} coupon={coupon} onDetails={() => setOpen(coupon)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <StudentCouponDetailsDialog coupon={open} onClose={() => setOpen(null)} />
    </div>
  );
};

export default StudentCouponsPage;
