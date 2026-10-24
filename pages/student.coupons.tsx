import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Gift, Ticket } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { StudentCouponCard, COUPON_BADGE, couponCategories } from "../components/StudentCouponCard";
import { useMySpinCoupons } from "../helpers/useSpinWin";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { discountLabel } from "../helpers/spinWinRules";
import { spinDateTime } from "../helpers/spinWinFormat";
import { STUDENT_COUPON_LABELS, studentCouponStatus } from "../helpers/studentCoupons";
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

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

const StudentCouponsPage: React.FC = () => {
  const { data, isError, error, refetch, isFetching } = useMySpinCoupons();
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<MySpinCoupon | null>(null);

  // Cached queries are not refetched on mount here, so pull fresh statuses on arrival.
  useEffect(() => {
    refetch();
  }, [refetch]);

  const coupons = data?.coupons ?? [];
  const counts = Object.fromEntries(TABS.map((t) => [t, coupons.filter((c) => inTab(c, t)).length])) as Record<Tab, number>;
  const savings = coupons.reduce((sum, c) => sum + (studentCouponStatus(c) === "redeemed" ? c.savedAmount ?? 0 : 0), 0);
  const visible = coupons.filter((c) => inTab(c, tab));

  return (
    <div className={styles.page}>
      <Helmet>
        <title>My Coupons | Testkart</title>
        <meta name="description" content="Your Testkart reward coupons, their status and savings." />
      </Helmet>
      <ConsolePageHeader title="My Coupons" />

      {isError ? (
        <ConsoleListEmpty tone="error" icon={<Ticket size={20} />} title="Your coupons could not be loaded" description={parseErrorMessage(error)}>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      ) : !data ? (
        <>
          <Skeleton style={{ height: "5.5rem", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "14rem", borderRadius: "var(--radius-md)" }} />
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
          <dl className={styles.summary} aria-label="Coupon summary">
            <div className={styles.peach}>
              <dt>Coupons earned</dt>
              <dd>{coupons.length}</dd>
            </div>
            <div className={styles.mint}>
              <dt>Available</dt>
              <dd>{counts.available}</dd>
            </div>
            <div className={styles.lavender}>
              <dt>Redeemed</dt>
              <dd>{counts.redeemed}</dd>
            </div>
            <div className={styles.butter}>
              <dt>Total savings</dt>
              <dd>{rupees(savings)}</dd>
            </div>
          </dl>

          <ConsoleListToolbar
            tabs={TABS.map((t) => ({ value: t, label: TAB_LABELS[t], count: counts[t] }))}
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            tabsLabel="Coupon status"
            panelId="coupon-list"
          />

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

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <ConsoleDialogContent size="sm">
          {open ? (
            <>
              <ConsoleDialogHeader title={open.code} description={`${open.campaignName} · ${open.rewardName}`}>
                <Badge variant={COUPON_BADGE[studentCouponStatus(open)]}>{STUDENT_COUPON_LABELS[studentCouponStatus(open)]}</Badge>
              </ConsoleDialogHeader>
              <ConsoleDialogBody>
                <dl className={styles.details}>
                  <div>
                    <dt>Discount</dt>
                    <dd>{discountLabel(open.discountType, open.discountValue)}</dd>
                  </div>
                  <div>
                    <dt>Valid on</dt>
                    <dd>{couponCategories(open.eligibleCategories)}</dd>
                  </div>
                  <div>
                    <dt>Minimum purchase</dt>
                    <dd>{open.minOrderValue > 0 ? `₹${open.minOrderValue} of eligible items` : "No minimum order requirement"}</dd>
                  </div>
                  <div>
                    <dt>Maximum discount</dt>
                    <dd>
                      {open.maxDiscountAmount ? `₹${open.maxDiscountAmount}, and ` : ""}
                      {open.maxDiscountPercent}% of eligible items
                    </dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{spinDateTime(open.issuedAt)}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{spinDateTime(open.expiresAt)}</dd>
                  </div>
                  {open.savedAmount !== null ? (
                    <div>
                      <dt>You saved</dt>
                      <dd>{rupees(open.savedAmount)}</dd>
                    </div>
                  ) : null}
                </dl>
                <ul className={styles.rules}>
                  <li>Single use, on one order, with no other promo code.</li>
                  <li>Tied to your account; it cannot be shared.</li>
                  <li>Only eligible items count toward the minimum and the discount.</li>
                </ul>
              </ConsoleDialogBody>
              <ConsoleDialogFooter>
                {studentCouponStatus(open) === "redeemed" && open.orderId ? (
                  <Button asChild variant="outline">
                    <Link to={`/order/${open.orderId}`}>View Order</Link>
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Close
                </Button>
              </ConsoleDialogFooter>
            </>
          ) : null}
        </ConsoleDialogContent>
      </Dialog>
    </div>
  );
};

export default StudentCouponsPage;