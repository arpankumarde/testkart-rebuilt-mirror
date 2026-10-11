import React, { useState } from "react";
import { Skeleton } from "./Skeleton";
import { Switch } from "./Switch";
import { Button } from "./Button";
import { CheckCircle, Info, Loader2, Shield } from "lucide-react";
import styles from "./TeacherSubscriptionAvailablePlans.module.css";
import { useSubscriptionPlansQuery } from "../helpers/useTeacherSubscription";

const PlansSkeleton: React.FC = () => (
  <div className={styles.plansGrid}>
    {[...Array(3)].map((_, i) => (
      <div key={i} className={styles.planCard}>
        <Skeleton style={{ height: "24px", width: "120px", margin: "0 auto" }} />
        <Skeleton style={{ height: "20px", width: "80%", margin: "8px auto 0" }} />
        <Skeleton style={{ height: "40px", width: "150px", margin: "24px auto" }} />
        <Skeleton style={{ height: "60px", width: "100%", margin: "0 auto 24px" }} />
        <Skeleton style={{ height: "1px", width: "100%", margin: "16px 0" }} />
        <Skeleton style={{ height: "20px", width: "90%", margin: "8px 0" }} />
        <Skeleton style={{ height: "20px", width: "85%", margin: "8px 0" }} />
        <Skeleton style={{ height: "20px", width: "95%", margin: "8px 0" }} />
        <Skeleton style={{ height: "40px", width: "100%", marginTop: "auto" }} />
      </div>
    ))}
  </div>
);

export interface AvailablePlansProps {
  plansQuery: ReturnType<typeof useSubscriptionPlansQuery>;
  hasActiveSub: boolean;
  currentPlanId?: number;
  // Set while new purchases are closed: only this plan (the teacher's own) is shown, to renew.
  renewOnlyPlanId?: number;
  // The current plan can be bought again, e.g. to restart autopay after a cancel.
  canRenewCurrentPlan?: boolean;
  subscriptionStatus: string | undefined;
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

export const TeacherSubscriptionAvailablePlans: React.FC<AvailablePlansProps> = ({
  plansQuery,
  hasActiveSub,
  currentPlanId,
  renewOnlyPlanId,
  canRenewCurrentPlan = false,
  subscriptionStatus,
  isInitiatingPayment,
  paymentMode,
  walletBalance,
  useWalletBalance,
  setUseWalletBalance,
  introOfferEligible = false,
  onSelectPlan,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  const getBaseName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("free")) return "Free";
    if (lower.includes("starter")) return "Starter";
    if (lower.includes("individual")) return "Individual";
    if (lower.includes("business")) return "Business";
    return null;
  };

  const plansByBaseName: Record<string, { monthly: any; yearly: any }> = {
    Free: { monthly: null, yearly: null },
    Starter: { monthly: null, yearly: null },
    Individual: { monthly: null, yearly: null },
    Business: { monthly: null, yearly: null },
  };

  if (plansQuery.data) {
    plansQuery.data.forEach((plan) => {
      const baseName = getBaseName(plan.name);
      if (!baseName) return;

      if (plan.billingCycle === "yearly" || plan.durationDays >= 360) {
        plansByBaseName[baseName].yearly = plan;
      } else {
        plansByBaseName[baseName].monthly = plan;
      }
    });
  }

  // Pick the correct plan based on toggle, fallback to whichever exists if missing
  const allPlansToDisplay = [
    plansByBaseName.Free.monthly || plansByBaseName.Free.yearly,
    plansByBaseName.Starter[isYearly ? "yearly" : "monthly"] ||
      plansByBaseName.Starter.monthly ||
      plansByBaseName.Starter.yearly,
    plansByBaseName.Individual[isYearly ? "yearly" : "monthly"] ||
      plansByBaseName.Individual.monthly ||
      plansByBaseName.Individual.yearly,
    plansByBaseName.Business[isYearly ? "yearly" : "monthly"] ||
      plansByBaseName.Business.monthly ||
      plansByBaseName.Business.yearly,
  ].filter(Boolean);

  // Once a teacher is on a paid plan, the grid below their active plan card
  // only offers upgrades: Free and their current tier are left out so the
  // page doesn't invite comparing down right next to "Choose a higher plan."
  // Cancelling (which does move them to Free) stays a clear, separate, visible
  // action on the Current Subscription card above - nothing about leaving is hidden.
  const PLAN_RANK: Record<string, number> = { Free: 0, Starter: 1, Individual: 2, Business: 3 };
  const currentPlanRecord = plansQuery.data?.find((plan) => plan.id === currentPlanId);
  const currentBaseName = currentPlanRecord ? getBaseName(currentPlanRecord.name) : null;
  const isPaidActive = hasActiveSub && !!currentPlanRecord && Number(currentPlanRecord.price) > 0;
  const upgradeOnlyPlansToDisplay = isPaidActive
    ? allPlansToDisplay.filter((plan) => {
        const baseName = getBaseName(plan.name) || "";
        return (PLAN_RANK[baseName] ?? 0) > (PLAN_RANK[currentBaseName || ""] ?? 0);
      })
    : allPlansToDisplay;
  const onTopTier = isPaidActive && upgradeOnlyPlansToDisplay.length === 0;

  const renewPlan =
    renewOnlyPlanId !== undefined
      ? plansQuery.data?.find((plan) => plan.id === renewOnlyPlanId)
      : undefined;
  const plansToDisplay =
    renewOnlyPlanId !== undefined ? (renewPlan ? [renewPlan] : []) : upgradeOnlyPlansToDisplay;

  return (
    <section className={styles.plansSection}>
      <h2 className={styles.sectionTitle}>
        {renewOnlyPlanId !== undefined ? "Renew your plan" : isPaidActive ? "Upgrade your plan" : "Plans"}
      </h2>

      {onTopTier && (
        <div className={styles.note}>
          <Info size={18} />
          <div>
            <p>
              You're on {currentBaseName}, our best plan here - the lowest platform fee and every
              feature unlocked. Nothing higher to move to.
            </p>
          </div>
        </div>
      )}

      {!onTopTier && renewOnlyPlanId === undefined && (
      <div className={styles.toolbar} role="tablist" aria-label="Billing period">
        <div className={styles.billingToggle}>
          <button
            type="button"
            role="tab"
            aria-selected={!isYearly}
            className={`${styles.toggleBtn} ${!isYearly ? styles.active : ""}`}
            onClick={() => setIsYearly(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isYearly}
            className={`${styles.toggleBtn} ${isYearly ? styles.active : ""}`}
            onClick={() => setIsYearly(true)}
          >
            Yearly <span className={styles.saveBadge}>2 months free</span>
          </button>
        </div>
      </div>
      )}

      {paymentMode === "normal" && walletBalance > 0 && (
        <div className={styles.walletCard}>
          <div className={styles.walletInfo}>
            <span className={styles.walletLabel}>Wallet balance</span>
            <span className={styles.walletAmount}>₹{walletBalance.toLocaleString("en-IN")}</span>
          </div>
          <div className={styles.walletToggle}>
            <label htmlFor="use-wallet">Put it towards this subscription</label>
            <Switch 
              id="use-wallet" 
              checked={useWalletBalance} 
              onCheckedChange={setUseWalletBalance} 
            />
          </div>
        </div>
      )}

      {plansQuery.isFetching && <PlansSkeleton />}
      {plansQuery.isError && (
        <p className={styles.errorText}>Could not load plans.</p>
      )}

      {plansToDisplay.length > 0 && (
        <>
          <div className={styles.plansGrid}>
            {plansToDisplay.map((plan) => {
              const baseName = getBaseName(plan.name) || "";
              const isFree = baseName === "Free";
              const isStarter = baseName === "Starter";
              const isIndividual = baseName === "Individual";
              const isBusiness = baseName === "Business";
              const isCurrentPlan = currentPlanId === plan.id;
              const isYearlyPlan =
                plan.billingCycle === "yearly" || plan.durationDays >= 360;

              const showIntroOffer =
                introOfferEligible && !isFree && !isCurrentPlan && introOfferAppliesTo(baseName, isYearlyPlan);

              return (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${
                    isStarter ? styles.mostPopular : ""
                  } ${isCurrentPlan ? styles.currentPlanCard : ""}`}
                >
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{baseName}</h3>
                    {showIntroOffer ? (
                      <span className={styles.popularBadge}>First month ₹{INTRO_OFFER_PRICE}</span>
                    ) : isStarter ? (
                      <span className={styles.popularBadge}>Recommended</span>
                    ) : null}
                    {isIndividual && !showIntroOffer && (
                      <span className={styles.bestValueBadge}>Best value</span>
                    )}
                    {isBusiness && (
                      <span className={styles.bestValueBadge}>For scale</span>
                    )}
                  </div>
                  <p className={styles.planDescription}>{plan.description}</p>

                  <div className={styles.planPriceContainer}>
                    {isFree ? (
                      <div className={styles.planPrice}>Free</div>
                    ) : showIntroOffer ? (
                      <div className={styles.planPrice}>
                        ₹{INTRO_OFFER_PRICE}
                        <span className={styles.pricePeriod}>/first month</span>
                      </div>
                    ) : (
                      <div className={styles.planPrice}>
                        ₹{plan.price.toLocaleString("en-IN")}
                        <span className={styles.pricePeriod}>
                          /{isYearlyPlan ? "year" : "month"}
                        </span>
                      </div>
                    )}
                    {showIntroOffer ? (
                      <div className={styles.effectiveMonthlyPrice}>
                        then ₹{plan.price.toLocaleString("en-IN")}/mo from month 2
                      </div>
                    ) : isYearlyPlan && !isFree ? (
                      <div className={styles.effectiveMonthlyPrice}>
                        ₹{Math.round(plan.price / 12).toLocaleString("en-IN")}/mo equivalent
                      </div>
                    ) : (
                      <div className={styles.effectiveMonthlyPricePlaceholder}>
                        &nbsp;
                      </div>
                    )}
                    
                    {useWalletBalance && paymentMode === "normal" && !isFree && walletBalance > 0 && (
                      <div className={styles.walletCalculation}>
                        {walletBalance >= plan.price ? (
                          <span className={styles.walletCovers}>Fully covered by wallet</span>
                        ) : (
                          <span>
                            Wallet pays: ₹{walletBalance.toLocaleString("en-IN")} <br/>
                            PayU: ₹{(plan.price - walletBalance).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.platformFeeBox}>
                    <span className={styles.feeIcon} aria-hidden>
                      <Shield size={16} strokeWidth={2} />
                    </span>
                    <span>
                      <span className={styles.feeValue}>{plan.platformFeePercentage}%</span>
                      <br />
                      <span className={styles.feeLabel}>Platform fee</span>
                    </span>
                  </div>

                  <hr className={styles.planDivider} />

                  <ul className={styles.planFeatures}>
                    {Array.isArray(plan.features) &&
                      (plan.features as any[]).map((feature: any, idx: number) => {
                        const featureStr = String(feature);
                        const isAi = featureStr.toLowerCase().includes("ai");
                        return (
                          <li
                            key={idx}
                            className={isAi ? styles.aiFeature : undefined}
                          >
                            <CheckCircle size={16} /> {featureStr}
                          </li>
                        );
                      })}
                  </ul>

                  <div className={styles.planAction}>
                    <Button
                      className={styles.subscribeButton}
                      onClick={() =>
                        onSelectPlan({
                          id: plan.id,
                          name: plan.name,
                          price: Number(plan.price),
                          durationDays: plan.durationDays,
                        })
                      }
                      disabled={(isCurrentPlan && !canRenewCurrentPlan) || isInitiatingPayment}
                      variant={
                        isCurrentPlan
                          ? "secondary"
                          : isStarter
                          ? "primary"
                          : "outline"
                      }
                    >
                      {isInitiatingPayment ? (
                        <>
                          <Loader2 size={16} className={styles.spinner} />{" "}
                          Processing...
                        </>
                      ) : isCurrentPlan && canRenewCurrentPlan ? (
                        "Restart Autopay"
                      ) : isCurrentPlan ? (
                        "Current Plan"
                      ) : isFree ? (
                        "Start Free"
                      ) : showIntroOffer ? (
                        `Start for ₹${INTRO_OFFER_PRICE}`
                      ) : hasActiveSub ? (
                        "Switch Plan"
                      ) : (
                        "Choose Plan"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {introOfferEligible && (
            <div className={styles.note}>
              <Info size={18} />
              <div>
                <p>
                  Starter and Individual (monthly) are ₹{INTRO_OFFER_PRICE} for the first month on autopay.
                  Your UPI Autopay mandate is set up for the plan's full price, and renews automatically at
                  that price from the second month unless you cancel first.
                </p>
              </div>
            </div>
          )}

          {renewOnlyPlanId === undefined && (
          <div className={styles.note}>
            <Info size={18} />
            <div>
              <p>
                Every plan includes unlimited courses and tests. Paying more buys a lower platform
                fee, a verified badge, AI tools and priority support.
              </p>
              <p>
                Your fee is locked in at the moment of each sale, so past sales keep the rate they
                were sold at even after you switch plans.
              </p>
            </div>
          </div>
          )}
        </>
      )}
    </section>
  );
};