import React, { useState } from "react";
import { Check, Info, Loader2, Wallet } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { Switch } from "./Switch";
import { Button } from "./Button";
import { useSubscriptionPlansQuery } from "../helpers/useTeacherSubscription";
import styles from "./TeacherSubscriptionAvailablePlans.module.css";

const PlansSkeleton: React.FC = () => (
  <div className={styles.plansGrid} aria-hidden>
    {[...Array(4)].map((_, i) => (
      <div key={i} className={styles.planCard}>
        <Skeleton style={{ height: "1.5rem", width: "7rem" }} />
        <Skeleton style={{ height: "1rem", width: "90%" }} />
        <Skeleton style={{ height: "2.5rem", width: "8rem", marginTop: "0.5rem" }} />
        <Skeleton style={{ height: "3.5rem", width: "100%" }} />
        <Skeleton style={{ height: "1rem", width: "85%" }} />
        <Skeleton style={{ height: "1rem", width: "75%" }} />
        <Skeleton style={{ height: "2.75rem", width: "100%", marginTop: "auto" }} />
      </div>
    ))}
  </div>
);

export interface AvailablePlansProps {
  id?: string;
  plansQuery: ReturnType<typeof useSubscriptionPlansQuery>;
  hasActiveSub: boolean;
  currentPlanId?: number;
  isInitiatingPayment: boolean;
  paymentMode: "normal" | "recurring";
  walletBalance: number;
  useWalletBalance: boolean;
  setUseWalletBalance: (val: boolean) => void;
  // True when a ₹1 first-cycle intro price applies to Starter/Individual monthly autopay sign-up.
  introOfferEligible?: boolean;
  onSelectPlan: (plan: {
    id: number;
    name: string;
    price: number;
    durationDays: number;
  }) => void;
}

const INTRO_OFFER_PRICE = 1;
const introOfferAppliesTo = (baseName: string, isYearlyPlan: boolean) =>
  !isYearlyPlan && (baseName === "Starter" || baseName === "Individual");

const PLAN_RANK: Record<string, number> = { Free: 0, Starter: 1, Individual: 2, Business: 3 };

export const getPlanBaseName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("free")) return "Free";
  if (lower.includes("starter")) return "Starter";
  if (lower.includes("individual")) return "Individual";
  if (lower.includes("business")) return "Business";
  return null;
};

// True when some plan ranks above the given one, i.e. the upgrade grid has cards to show.
export const hasPlanAbove = (planName: string | undefined) =>
  (PLAN_RANK[getPlanBaseName(planName ?? "") ?? "Free"] ?? 0) < PLAN_RANK.Business;

const formatInr = (amount: number) =>
  (Math.round(amount * 100) / 100).toLocaleString("en-IN");

export const TeacherSubscriptionAvailablePlans: React.FC<AvailablePlansProps> = ({
  id,
  plansQuery,
  hasActiveSub,
  currentPlanId,
  isInitiatingPayment,
  paymentMode,
  walletBalance,
  useWalletBalance,
  setUseWalletBalance,
  introOfferEligible = false,
  onSelectPlan,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  type PlanRow = NonNullable<typeof plansQuery.data>[number];
  const plansByBaseName: Record<string, { monthly: PlanRow | null; yearly: PlanRow | null }> = {
    Free: { monthly: null, yearly: null },
    Starter: { monthly: null, yearly: null },
    Individual: { monthly: null, yearly: null },
    Business: { monthly: null, yearly: null },
  };

  plansQuery.data?.forEach((plan) => {
    const baseName = getPlanBaseName(plan.name);
    if (!baseName) return;
    if (plan.billingCycle === "yearly" || plan.durationDays >= 360) {
      plansByBaseName[baseName].yearly = plan;
    } else {
      plansByBaseName[baseName].monthly = plan;
    }
  });

  const pick = (baseName: string) => {
    const group = plansByBaseName[baseName];
    return group[isYearly ? "yearly" : "monthly"] || group.monthly || group.yearly;
  };

  const allPlans = [pick("Free"), pick("Starter"), pick("Individual"), pick("Business")].filter(
    (plan): plan is PlanRow => !!plan,
  );

  // On a paid plan the grid only offers upgrades: Free and the current tier are
  // left out. Cancelling stays a visible action on the "Your plan" card above.
  const currentPlanRecord = plansQuery.data?.find((plan) => plan.id === currentPlanId);
  const currentBaseName = currentPlanRecord ? getPlanBaseName(currentPlanRecord.name) : null;
  const isPaidActive = hasActiveSub && !!currentPlanRecord && Number(currentPlanRecord.price) > 0;
  const plansToDisplay = isPaidActive
    ? allPlans.filter(
        (plan) =>
          (PLAN_RANK[getPlanBaseName(plan.name) || ""] ?? 0) >
          (PLAN_RANK[currentBaseName || ""] ?? 0),
      )
    : allPlans;

  if (isPaidActive && plansQuery.data && plansToDisplay.length === 0) return null;

  const hasYearly = Object.values(plansByBaseName).some((group) => group.yearly);

  return (
    <section id={id} className={styles.plansSection} aria-labelledby="plans-title">
      <div className={styles.sectionHead}>
        <div className={styles.sectionIntro}>
          <h2 id="plans-title" className={styles.sectionTitle}>
            {isPaidActive ? "Upgrade your plan" : "Plans"}
          </h2>
          <p className={styles.sectionLede}>
            Every plan includes unlimited courses and tests. A higher plan lowers your fee and adds
            more AI questions.
          </p>
        </div>

        {hasYearly && (
          <div className={styles.billingToggle} role="group" aria-label="Billing period">
            <button
              type="button"
              aria-pressed={!isYearly}
              className={styles.toggleBtn}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={isYearly}
              className={styles.toggleBtn}
              onClick={() => setIsYearly(true)}
            >
              Yearly <span className={styles.saveBadge}>2 months free</span>
            </button>
          </div>
        )}
      </div>

      {paymentMode === "normal" && walletBalance > 0 && (
        <div className={styles.walletBar}>
          <span className={styles.walletIcon} aria-hidden>
            <Wallet size={18} />
          </span>
          <div className={styles.walletInfo}>
            <span className={styles.walletLabel}>Available balance</span>
            <span className={styles.walletAmount}>₹{formatInr(walletBalance)}</span>
          </div>
          <label htmlFor="use-wallet" className={styles.walletToggle}>
            Use it for this plan
            <Switch id="use-wallet" checked={useWalletBalance} onCheckedChange={setUseWalletBalance} />
          </label>
        </div>
      )}

      {plansQuery.isPending && <PlansSkeleton />}

      {plansQuery.isError && !plansQuery.data && (
        <div className={styles.errorBox}>
          <p>We could not load the plans.</p>
          <Button variant="outline" size="sm" onClick={() => plansQuery.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {plansToDisplay.length > 0 && (
        <div className={styles.plansGrid}>
          {plansToDisplay.map((plan) => {
            const baseName = getPlanBaseName(plan.name) || "";
            const isFree = baseName === "Free";
            const isCurrentPlan = currentPlanId === plan.id;
            const isYearlyPlan = plan.billingCycle === "yearly" || plan.durationDays >= 360;
            const price = Number(plan.price);
            const fee = Number(plan.platformFeePercentage);
            const showIntroOffer =
              introOfferEligible && !isFree && !isCurrentPlan && introOfferAppliesTo(baseName, isYearlyPlan);
            const isFeatured = !isCurrentPlan && (showIntroOffer || baseName === "Starter");

            const tag = isCurrentPlan
              ? "Your plan"
              : showIntroOffer
                ? `First month ₹${INTRO_OFFER_PRICE}`
                : baseName === "Starter"
                  ? "Recommended"
                  : baseName === "Individual"
                    ? "Best value"
                    : baseName === "Business"
                      ? "For institutes"
                      : null;

            const priceNote = showIntroOffer
              ? `then ₹${formatInr(price)}/month from month 2`
              : isYearlyPlan && !isFree
                ? `₹${formatInr(Math.round(price / 12))}/month, billed yearly`
                : isFree
                  ? "No card needed"
                  : "Billed monthly";

            const features = (Array.isArray(plan.features) ? (plan.features as unknown[]) : [])
              .map((feature) => String(feature))
              .filter((feature) => !/platform fee/i.test(feature));

            const payable = showIntroOffer ? INTRO_OFFER_PRICE : price;
            const showWalletSplit =
              useWalletBalance && paymentMode === "normal" && !isFree && walletBalance > 0;

            const actionLabel = isCurrentPlan
              ? "Your current plan"
              : isFree
                ? "Start free"
                : showIntroOffer
                  ? `Start for ₹${INTRO_OFFER_PRICE}`
                  : hasActiveSub && !isFree && isPaidActive
                    ? `Upgrade to ${baseName}`
                    : `Choose ${baseName}`;

            return (
              <article
                key={plan.id}
                className={`${styles.planCard} ${isFeatured ? styles.featured : ""} ${
                  isCurrentPlan ? styles.current : ""
                }`}
                aria-label={`${baseName} plan`}
              >
                <div className={styles.planHeader}>
                  <h3 className={styles.planName}>{baseName}</h3>
                  {tag && (
                    <span
                      className={`${styles.tag} ${isFeatured ? styles.tagFeatured : ""} ${
                        isCurrentPlan ? styles.tagCurrent : ""
                      }`}
                    >
                      {tag}
                    </span>
                  )}
                </div>
                {plan.description && <p className={styles.planDescription}>{plan.description}</p>}

                <div className={styles.priceBlock}>
                  <p className={styles.price}>
                    {isFree ? "₹0" : `₹${formatInr(payable)}`}
                    <span className={styles.pricePeriod}>
                      {isFree ? "forever" : showIntroOffer ? "/first month" : isYearlyPlan ? "/year" : "/month"}
                    </span>
                  </p>
                  <p className={styles.priceNote}>{priceNote}</p>
                </div>

                <div className={styles.feeRow}>
                  <span className={styles.feeValue}>{formatInr(fee)}%</span>
                  <span className={styles.feeText}>
                    <strong>platform fee</strong>
                    You keep ₹{formatInr(100 - fee)} of every ₹100
                  </span>
                </div>

                {showWalletSplit && (
                  <p className={styles.walletSplit}>
                    {walletBalance >= payable
                      ? "Fully covered by your balance"
                      : `₹${formatInr(walletBalance)} from balance, ₹${formatInr(payable - walletBalance)} online`}
                  </p>
                )}

                {features.length > 0 && (
                  <ul className={styles.features}>
                    {features.map((feature, idx) => (
                      <li key={idx}>
                        <Check size={16} strokeWidth={2.5} aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  className={`${styles.planButton} ${isFeatured ? styles.planButtonPrimary : ""}`}
                  onClick={() =>
                    onSelectPlan({
                      id: plan.id,
                      name: plan.name,
                      price,
                      durationDays: plan.durationDays,
                    })
                  }
                  disabled={isCurrentPlan || isInitiatingPayment}
                  aria-busy={isInitiatingPayment || undefined}
                >
                  {isInitiatingPayment && !isCurrentPlan ? (
                    <>
                      <Loader2 size={16} className={styles.spinner} aria-hidden /> Processing...
                    </>
                  ) : (
                    actionLabel
                  )}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {plansToDisplay.length > 0 && (
        <div className={styles.note}>
          <Info size={18} aria-hidden />
          <div>
            {introOfferEligible && (
              <p>
                Starter and Individual (monthly) are ₹{INTRO_OFFER_PRICE} for the first month on autopay.
                Autopay is set up for the plan's full price and renews at that price from the second month
                unless you cancel first.
              </p>
            )}
            <p>
              Your fee is locked in at the moment of each sale, so past sales keep the rate they were sold
              at even after you switch plans.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
