import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { postPaymentPayuSubscriptionVerifyAndComplete } from "../endpoints/payment/payu/subscription/verify-and-complete_POST.schema";
import {
  useSubscriptionStatusQuery,
  useSubscriptionPlansQuery,
  useSubscriptionHistoryQuery,
  useCancelSubscriptionMutation,
  useSubscribeToPlanMutation,
  useValidatePromoCodeMutation,
} from "../helpers/useTeacherSubscription";
import {
  useMandateStatusQuery,
  useAutoRenewalCheck,
} from "../helpers/useRecurringPayment";
import { useTeacherSubscriptionPaymentInfoQuery, useTeacherWalletSubscribeMutation } from "../helpers/useTeacherWalletSubscriptionHooks";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { Tag, X as XIcon, CheckCircle2, ChevronDown, AlertCircle } from "lucide-react";
import { postPaymentPayuRecurringCreateMandate } from "../endpoints/payment/payu/recurring/create-mandate_POST.schema";
import { postPaymentPayuRedirect } from "../endpoints/payment/payu/redirect_POST.schema";
import { CurrentSubscriptionStatus } from "../components/CurrentSubscriptionStatus";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { TeacherSubscriptionAvailablePlans } from "../components/TeacherSubscriptionAvailablePlans";
import { TeacherSubscriptionTransactionHistory } from "../components/TeacherSubscriptionTransactionHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/Dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { paymentFailureReason } from "../helpers/paymentFailureReason";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";

import styles from "./teacher.subscription.module.css";

const promoErrorTitle = (message: string) => {
  const text = message.toLowerCase();
  if (text.includes("already used")) return "Already used";
  if (text.includes("usage limit")) return "Limit reached";
  if (text.includes("no longer active")) return "Expired";
  if (text.includes("not valid at this time")) return "Not valid now";
  if (text.includes("invalid")) return "Not recognised";
  return "Can't apply";
};

const formatInr = (amount: number) => {
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toLocaleString("en-IN", Number.isInteger(rounded) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SubscriptionPage: React.FC = () => {
  const [historyPage, setHistoryPage] = useState(1);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{id: number; name: string; price: number; durationDays: number} | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    finalPrice: number;
    recurringScope: "first_month" | "every_month";
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  // Bumped whenever the dialog's plan or promo state resets, so a late
  // validation reply for an earlier plan is dropped instead of applied.
  const promoRequestRef = useRef(0);
  const validatePromoMutation = useValidatePromoCodeMutation();

  const paymentInfoQuery = useTeacherSubscriptionPaymentInfoQuery();
  const paymentMode = paymentInfoQuery.data?.paymentMode || "normal";
  const walletBalance = paymentInfoQuery.data?.walletBalance || 0;
  const [useWalletBalance, setUseWalletBalance] = useState(true);

  const statusQuery = useSubscriptionStatusQuery();
  const mandateQuery = useMandateStatusQuery({ enabled: paymentMode === "recurring" });
  const effectiveMandateQuery = paymentMode === "normal" ? { ...mandateQuery, data: null } as any : mandateQuery;
  const plansQuery = useSubscriptionPlansQuery();
  const walletSubscribeMutation = useTeacherWalletSubscribeMutation();
  const historyQuery = useSubscriptionHistoryQuery(historyPage, 10);
  const cancelMutation = useCancelSubscriptionMutation();
  const subscribeMutation = useSubscribeToPlanMutation();

  // Auto-renewal check on page load
  useAutoRenewalCheck(statusQuery.data?.id);

  // Handle PayU callback status from URL parameters with immediate verification
  useEffect(() => {
    const status = searchParams.get("status");
    const cancelled = searchParams.get("cancelled");
    const error = searchParams.get("error");
    const txnid = searchParams.get("txnid");

    if (status === "success" && txnid && !isVerifyingPayment) {
      setIsVerifyingPayment(true);
      const verifyToastId = toast.loading("Verifying your payment...");

      postPaymentPayuSubscriptionVerifyAndComplete({ txnid })
        .then((result) => {
          if (result.success && result.status === "completed") {
            toast.success(
              "Payment verified! Your subscription is now active.",
              { id: verifyToastId }
            );
            statusQuery.refetch();
            mandateQuery.refetch();
          } else if (result.status === "pending") {
            toast.loading(
              "Payment is still processing. Please wait a moment...",
              { id: verifyToastId }
            );
            setTimeout(() => {
              statusQuery.refetch();
            }, 3000);
          } else {
            toast.error(
              result.message ||
                "Payment verification failed. Please contact support.",
              { id: verifyToastId }
            );
          }
        })
        .catch((err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to verify payment. Your subscription will activate via callback.",
            { id: verifyToastId }
          );
          statusQuery.refetch();
        })
        .finally(() => {
          setIsVerifyingPayment(false);
          setSearchParams({}, { replace: true });
        });
    } else if (status === "success" && !txnid) {
      toast.success("Subscription activated successfully!");
      statusQuery.refetch();
      setSearchParams({}, { replace: true });
    } else if (status === "mandate_created") {
      toast.success("Autopay is on. Your subscription will renew automatically.");
      statusQuery.refetch();
      mandateQuery.refetch();
      setSearchParams({}, { replace: true });
    } else if (status === "activated_without_autopay") {
      toast.warning(
        "Your subscription is active, but autopay could not be set up. You will need to renew it yourself."
      );
      statusQuery.refetch();
      setSearchParams({}, { replace: true });
    } else if (status === "failed") {
      const failure = paymentFailureReason.parse(searchParams.get("reason"));
      toast.error(failure ? `Payment failed. ${failure.payerMessage}` : "Payment failed. Please try again.");
      setSearchParams({}, { replace: true });
    } else if (cancelled === "true") {
      toast.warning("Payment cancelled. You can retry anytime.");
      setSearchParams({}, { replace: true });
    } else if (error === "invalid_hash") {
      toast.error("Payment verification failed. Please contact support.");
      setSearchParams({}, { replace: true });
    } else if (error) {
      toast.error(
        `Payment error: ${error}. Please try again or contact support.`
      );
      setSearchParams({}, { replace: true });
    }
    }, [
    searchParams,
    setSearchParams,
    isVerifyingPayment,
  ]);

  const handleSelectPlan = async (plan: {
    id: number;
    name: string;
    price: number;
    durationDays: number;
  }) => {
    if (plan.price === 0) {
      toast.promise(subscribeMutation.mutateAsync({ planId: plan.id }), {
        loading: "Activating free plan...",
        success: "Free plan activated successfully!",
        error: (err) =>
          err instanceof Error
            ? err.message
            : "Failed to activate free plan.",
      });
      return;
    }

    // Both payment modes now confirm through the same dialog below, so a
    // promo code has one place to be entered before either flow redirects.
    setPromoCodeInput("");
    setAppliedPromo(null);
    setPromoError(null);
    setPromoOpen(false);
    promoRequestRef.current += 1;
    setPendingPlan(plan);
  };

  const handleApplyPromoCode = async () => {
    if (!pendingPlan || !promoCodeInput.trim() || validatePromoMutation.isPending) return;
    setPromoError(null);
    const requestId = ++promoRequestRef.current;
    try {
      const result = await validatePromoMutation.mutateAsync({
        code: promoCodeInput.trim(),
        planId: pendingPlan.id,
      });
      if (requestId !== promoRequestRef.current) return;
      setAppliedPromo({
        code: result.code,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
        recurringScope: result.recurringScope,
      });
    } catch (error) {
      if (requestId !== promoRequestRef.current) return;
      setAppliedPromo(null);
      setPromoError(error instanceof Error ? error.message : "Could not apply this code.");
    }
  };

  const handleRemovePromoCode = () => {
    promoRequestRef.current += 1;
    setAppliedPromo(null);
    setPromoError(null);
    setPromoCodeInput("");
    setPromoOpen(false);
  };

  const handleConfirmSubscription = async () => {
    if (!pendingPlan) return;
    setIsInitiatingPayment(true);
    const loadingToast = toast.loading("Processing payment...");

    if (paymentMode === "recurring") {
      try {
        const paymentData = await postPaymentPayuRecurringCreateMandate({
          planId: pendingPlan.id,
          promoCode: appliedPromo?.code,
        });
        toast.success("Redirecting to payment gateway...", { id: loadingToast });
        setTimeout(() => {
          postPaymentPayuRedirect(paymentData);
        }, 500);
      } catch (error) {
        setIsInitiatingPayment(false);
        toast.error(
          error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
          { id: loadingToast }
        );
      }
      return;
    }

    try {
      const result = await walletSubscribeMutation.mutateAsync({
        planId: pendingPlan.id,
        useWallet: useWalletBalance,
        promoCode: appliedPromo?.code,
      });
      
      if (result.status === "completed") {
        toast.success("Subscription activated successfully!", { id: loadingToast });
        statusQuery.refetch();
        paymentInfoQuery.refetch();
        setIsInitiatingPayment(false);
        setPendingPlan(null);
      } else if (result.status === "payment_required") {
        if (result.walletDeducted > 0) {
          toast.loading(`₹${result.walletDeducted} deducted from wallet. Redirecting to pay ₹${result.payuData.amount} via PayU...`, { id: loadingToast });
        } else {
          toast.success("Redirecting to payment gateway...", { id: loadingToast });
        }
        setTimeout(() => {
          postPaymentPayuRedirect(result.payuData);
        }, 500);
      }
    } catch (error) {
      setIsInitiatingPayment(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
        { id: loadingToast }
      );
    }
  };

  // The mutation shows its own success and error toasts.
  const handleConfirmCancel = () => {
    cancelMutation.mutate(undefined, {
      onSettled: () => setConfirmCancelOpen(false),
    });
  };

  const hasActiveSub = !!statusQuery.data;
  const currentSub = statusQuery.data;
  const hasPaidSub = hasActiveSub && (currentSub?.planPrice ?? 0) > 0;
  const currentEndDate = currentSub?.endDate
    ? new Date(currentSub.endDate).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;
  // A paid plan whose autopay was cancelled can be bought again to restart it.
  const canRenewCurrentPlan =
    paymentMode === "recurring" &&
    (currentSub?.planPrice ?? 0) > 0 &&
    !(currentSub?.autoRenew && mandateQuery.data?.mandateStatus === "active");

  return (
    <>
      <Helmet>
        <title>Fees and billing - Testkart</title>
        <meta
          name="description"
          content="See your Testkart platform fee, manage an existing subscription and view your billing history."
        />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Fees & billing" />

        <CurrentSubscriptionStatus
          statusQuery={statusQuery}
          mandateQuery={effectiveMandateQuery}
          paymentMode={paymentMode}
          onCancel={() => setConfirmCancelOpen(true)}
          isCancelling={cancelMutation.isPending}
        />

        <TeacherSubscriptionAvailablePlans
          plansQuery={plansQuery}
          hasActiveSub={hasActiveSub}
          currentPlanId={statusQuery.data?.planId}
          canRenewCurrentPlan={canRenewCurrentPlan}
          subscriptionStatus={statusQuery.data?.status}
          isInitiatingPayment={isInitiatingPayment}
          onSelectPlan={handleSelectPlan}
          paymentMode={paymentMode}
          walletBalance={walletBalance}
          useWalletBalance={useWalletBalance}
          setUseWalletBalance={setUseWalletBalance}
          introOfferEligible={paymentMode === "recurring" && !!paymentInfoQuery.data?.introOfferEligible}
        />

          <TeacherSubscriptionTransactionHistory
            historyQuery={historyQuery}
            historyPage={historyPage}
            onPageChange={setHistoryPage}
          />
      </div>

      <Dialog open={confirmCancelOpen} onOpenChange={(open) => !open && !cancelMutation.isPending && setConfirmCancelOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              {paymentMode === "recurring"
                ? "Autopay will be turned off with your bank or UPI app, and you won't be charged again."
                : "Your plan won't renew and you won't be charged again."}{" "}
              You keep {currentSub?.planName ?? "your plan"}
              {currentEndDate ? ` until ${currentEndDate}` : ""}, then your account moves to the standard {DEFAULT_TEACHER_PLATFORM_FEE}% platform fee. Once it ends, the plan can't be bought again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)} disabled={cancelMutation.isPending}>
              Keep Subscription
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? (
                <><Loader2 size={16} className={styles.spinner} style={{ marginRight: 8 }} /> Cancelling...</>
              ) : (
                "Cancel Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingPlan} onOpenChange={(open) => !open && !isInitiatingPayment && setPendingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Subscription Payment</DialogTitle>
            <DialogDescription>
              You are about to subscribe to the {pendingPlan?.name} plan for {pendingPlan?.durationDays} days.
            </DialogDescription>
          </DialogHeader>

          {pendingPlan && (
            <div className={styles.paymentBreakdown}>
              <div className={styles.summaryCard}>
                <div className={styles.breakdownRow}>
                  <span>Plan Price:</span>
                  <strong>₹{formatInr(pendingPlan.price)}</strong>
                </div>

                <div className={styles.promoSection}>
                  {appliedPromo ? (
                    <div className={styles.promoApplied} role="status">
                      <CheckCircle2 size={18} className={styles.promoAppliedIcon} aria-hidden />
                      <div className={styles.promoAppliedText}>
                        <span className={styles.promoAppliedCode}>{appliedPromo.code} applied</span>
                        <span className={styles.promoAppliedNote}>
                          You save ₹{formatInr(appliedPromo.discountAmount)}
                          {appliedPromo.recurringScope === "every_month" ? " now and on every renewal" : " on this payment"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.promoRemoveButton}
                        onClick={handleRemovePromoCode}
                        disabled={isInitiatingPayment}
                        aria-label={`Remove promo code ${appliedPromo.code}`}
                      >
                        <XIcon size={14} aria-hidden />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.promoToggle}
                        aria-expanded={promoOpen}
                        aria-controls="promo-code-panel"
                        onClick={() => setPromoOpen((open) => !open)}
                        disabled={isInitiatingPayment}
                      >
                        <Tag size={16} aria-hidden />
                        <span>Have a promo code?</span>
                        <ChevronDown size={16} className={styles.promoChevron} aria-hidden />
                      </button>

                      {promoOpen && (
                        <form
                          id="promo-code-panel"
                          className={styles.promoForm}
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleApplyPromoCode();
                          }}
                          noValidate
                        >
                          <div className={styles.promoField}>
                            <input
                              type="text"
                              className={styles.promoInput}
                              placeholder="Enter promo code"
                              aria-label="Promo code"
                              value={promoCodeInput}
                              onChange={(e) => {
                                setPromoCodeInput(e.target.value.toUpperCase());
                                if (promoError) setPromoError(null);
                              }}
                              readOnly={validatePromoMutation.isPending}
                              disabled={isInitiatingPayment}
                              aria-invalid={!!promoError}
                              aria-describedby={promoError ? "promo-code-error" : undefined}
                              autoComplete="off"
                              autoCapitalize="characters"
                              spellCheck={false}
                              autoFocus
                            />
                            <button
                              type="submit"
                              className={styles.promoApply}
                              disabled={!promoCodeInput.trim() || validatePromoMutation.isPending || isInitiatingPayment}
                              aria-busy={validatePromoMutation.isPending}
                            >
                              {validatePromoMutation.isPending ? (
                                <>
                                  <Loader2 size={14} className={styles.spinner} aria-hidden />
                                  Checking
                                </>
                              ) : (
                                "Apply"
                              )}
                            </button>
                          </div>
                          {promoError && (
                            <p id="promo-code-error" className={styles.promoError} role="alert">
                              <AlertCircle size={16} aria-hidden />
                              <span>
                                <strong>{promoErrorTitle(promoError)}:</strong> {promoError}
                              </span>
                            </p>
                          )}
                        </form>
                      )}
                    </>
                  )}
                </div>

                {appliedPromo && (
                  <>
                    <div className={styles.breakdownRow}>
                      <span>Promo Discount ({appliedPromo.code}):</span>
                      <strong className={styles.successText}>-₹{formatInr(appliedPromo.discountAmount)}</strong>
                    </div>
                    <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                      <span>Total Payable:</span>
                      <strong>₹{formatInr(appliedPromo.finalPrice)}</strong>
                    </div>
                  </>
                )}
              </div>

              {paymentMode === "normal" && walletBalance > 0 && (
                <div className={styles.walletToggleRow}>
                  <label htmlFor="dialog-use-wallet">Use Wallet Balance (Available: ₹{formatInr(walletBalance)})</label>
                  <Switch 
                    id="dialog-use-wallet" 
                    className={styles.walletSwitch}
                    checked={useWalletBalance} 
                    onCheckedChange={setUseWalletBalance} 
                  />
                </div>
              )}

              {paymentMode === "recurring" ? (
                <p className={styles.warningNote}>
                  You'll set up autopay and be charged ₹{formatInr(appliedPromo?.finalPrice ?? pendingPlan.price)} now
                  {appliedPromo?.recurringScope === "every_month"
                    ? `. Future renewals are discounted the same way, for ₹${formatInr(Math.max(1, pendingPlan.price - appliedPromo.discountAmount))} each.`
                    : `. Renewals after this cycle are charged the full ₹${formatInr(pendingPlan.price)}.`}
                </p>
              ) : useWalletBalance && walletBalance > 0 ? (
                <>
                  <div className={styles.breakdownRow}>
                    <span>Wallet Deduction:</span>
                    <strong className={styles.successText}>
                      -₹{formatInr(Math.min(walletBalance, appliedPromo?.finalPrice ?? pendingPlan.price))}
                    </strong>
                  </div>
                  <div className={styles.breakdownRow}>
                    <span>To Pay via PayU:</span>
                    {walletBalance >= (appliedPromo?.finalPrice ?? pendingPlan.price) ? (
                      <strong className={styles.successText}>No additional payment needed</strong>
                    ) : (
                      <strong>₹{formatInr((appliedPromo?.finalPrice ?? pendingPlan.price) - walletBalance)}</strong>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.breakdownRow}>
                  <span>Full payment via PayU:</span>
                  <strong>₹{formatInr(appliedPromo?.finalPrice ?? pendingPlan.price)}</strong>
                </div>
              )}

              {paymentMode === "normal" && (
                <p className={styles.warningNote}>
                  Wallet deductions are non-refundable and will be reflected in your transaction history.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className={styles.payCancelButton} onClick={() => setPendingPlan(null)} disabled={isInitiatingPayment}>
              Cancel
            </Button>
            <Button className={styles.payConfirmButton} onClick={handleConfirmSubscription} disabled={isInitiatingPayment}>
              {isInitiatingPayment ? (
                <><Loader2 size={16} className={styles.spinner} style={{ marginRight: 8 }} /> Processing...</>
              ) : (
                "Confirm & Pay"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubscriptionPage;