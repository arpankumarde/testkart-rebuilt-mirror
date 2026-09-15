import React, { useState } from "react";
import { Skeleton } from "./Skeleton";
import { Switch } from "./Switch";
import { Button } from "./Button";
import { CheckCircle, Info, Loader2 } from "lucide-react";
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
  subscriptionStatus: string | undefined;
  isInitiatingPayment: boolean;
  paymentMode: "normal" | "recurring";
  walletBalance: number;
  useWalletBalance: boolean;
  setUseWalletBalance: (val: boolean) => void;
  onSelectPlan: (plan: {
    id: number;
    name: string;
    price: number;
    durationDays: number;
  }) => void;
}

export const TeacherSubscriptionAvailablePlans: React.FC<AvailablePlansProps> = ({
  plansQuery,
  hasActiveSub,
  currentPlanId,
  subscriptionStatus,
  isInitiatingPayment,
  paymentMode,
  walletBalance,
  useWalletBalance,
  setUseWalletBalance,
  onSelectPlan,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  const getBaseName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("free")) return "Free";
    if (lower.includes("starter")) return "Starter";
    if (lower.includes("individual")) return "Individual";
    return null;
  };

  const plansByBaseName: Record<string, { monthly: any; yearly: any }> = {
    Free: { monthly: null, yearly: null },
    Starter: { monthly: null, yearly: null },
    Individual: { monthly: null, yearly: null },
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
  const plansToDisplay = [
    plansByBaseName.Free.monthly || plansByBaseName.Free.yearly,
    plansByBaseName.Starter[isYearly ? "yearly" : "monthly"] ||
      plansByBaseName.Starter.monthly ||
      plansByBaseName.Starter.yearly,
    plansByBaseName.Individual[isYearly ? "yearly" : "monthly"] ||
      plansByBaseName.Individual.monthly ||
      plansByBaseName.Individual.yearly,
  ].filter(Boolean);

  return (
    <section className={styles.plansSection}>
      <h2 className={styles.sectionTitle}>Plans</h2>

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
              const isCurrentPlan = currentPlanId === plan.id;
              const isYearlyPlan =
                plan.billingCycle === "yearly" || plan.durationDays >= 360;

              let feeColorClass = styles.feeLow;
              if (plan.platformFeePercentage >= 25) {
                feeColorClass = styles.feeHigh;
              } else if (plan.platformFeePercentage >= 15) {
                feeColorClass = styles.feeMedium;
              }

              return (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${
                    isStarter ? styles.mostPopular : ""
                  } ${isCurrentPlan ? styles.currentPlanCard : ""}`}
                >
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{baseName}</h3>
                    {isStarter && (
                      <span className={styles.popularBadge}>Recommended</span>
                    )}
                    {isIndividual && (
                      <span className={styles.bestValueBadge}>Best value</span>
                    )}
                  </div>
                  <p className={styles.planDescription}>{plan.description}</p>

                  <div className={styles.planPriceContainer}>
                    {isFree ? (
                      <div className={styles.planPrice}>Free</div>
                    ) : (
                      <div className={styles.planPrice}>
                        ₹{plan.price.toLocaleString("en-IN")}
                        <span className={styles.pricePeriod}>
                          /{isYearlyPlan ? "year" : "month"}
                        </span>
                      </div>
                    )}
                    {isYearlyPlan && !isFree ? (
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

                  <div className={`${styles.platformFeeBox} ${feeColorClass}`}>
                    <span className={styles.feeLabel}>Platform fee</span>
                    <span className={styles.feeValue}>
                      {plan.platformFeePercentage}%
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
                      disabled={isCurrentPlan || isInitiatingPayment}
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
                      ) : isCurrentPlan ? (
                        "Current Plan"
                      ) : isFree ? (
                        "Start Free"
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
        </>
      )}
    </section>
  );
};