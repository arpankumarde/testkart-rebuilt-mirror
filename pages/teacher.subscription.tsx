import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { postPaymentPayuSubscriptionVerifyAndComplete } from "../endpoints/payment/payu/subscription/verify-and-complete_POST.schema";
import {
  useSubscriptionStatusQuery,
  useSubscriptionPlansQuery,
  useSubscriptionHistoryQuery,
  useCancelSubscriptionMutation,
  useSubscribeToPlanMutation,
} from "../helpers/useTeacherSubscription";
import {
  useMandateStatusQuery,
  useCancelMandateMutation,
  useAutoRenewalCheck,
} from "../helpers/useRecurringPayment";
import { useTeacherSubscriptionPaymentInfoQuery, useTeacherWalletSubscribeMutation } from "../helpers/useTeacherWalletSubscriptionHooks";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";
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

import styles from "./teacher.subscription.module.css";

const SubscriptionPage: React.FC = () => {
  const [historyPage, setHistoryPage] = useState(1);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{id: number; name: string; price: number; durationDays: number} | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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
  const cancelMandateMutation = useCancelMandateMutation();
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
      toast.success(
        "UPI Autopay activated! Your subscription will auto-renew."
      );
      statusQuery.refetch();
      mandateQuery.refetch();
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

    if (paymentMode === "recurring") {
      setIsInitiatingPayment(true);
      const loadingToast = toast.loading("Setting up UPI Autopay payment...");
      try {
        const paymentData = await postPaymentPayuRecurringCreateMandate({
          planId: plan.id,
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
    } else {
      setPendingPlan(plan);
    }
  };

  const handleConfirmSubscription = async () => {
    if (!pendingPlan) return;
    setIsInitiatingPayment(true);
    const loadingToast = toast.loading("Processing payment...");
    try {
      const result = await walletSubscribeMutation.mutateAsync({
        planId: pendingPlan.id,
        useWallet: useWalletBalance
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

  const handleCancel = () => {
    toast.promise(cancelMutation.mutateAsync(), {
      loading: "Cancelling your subscription...",
      success: "Your subscription has been cancelled.",
      error: (err) =>
        err instanceof Error ? err.message : "Cancellation failed.",
    });
  };

  const handleCancelMandate = () => {
    if (!statusQuery.data?.id) {
      toast.error("No active subscription found.");
      return;
    }
    toast.promise(
      cancelMandateMutation.mutateAsync({
        subscriptionId: statusQuery.data.id,
      }),
      {
        loading: "Cancelling auto-renewal...",
        success:
          "Auto-renewal has been cancelled. Your subscription will remain active until it expires.",
        error: (err) =>
          err instanceof Error
            ? err.message
            : "Failed to cancel auto-renewal.",
      }
    );
  };

  const hasActiveSub = !!statusQuery.data;

  return (
    <>
      <Helmet>
        <title>Choose Your Plan - Testkart</title>
        <meta
          name="description"
          content="Manage your Testkart teacher subscription, view plans, and see your billing history."
        />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Subscription" />

        {hasActiveSub && (statusQuery.data?.planPrice ?? 0) > 0 && (
          <CurrentSubscriptionStatus
            statusQuery={statusQuery}
            mandateQuery={effectiveMandateQuery}
            onCancel={handleCancel}
            onCancelMandate={handleCancelMandate}
            isCancelling={cancelMutation.isPending}
            isCancellingMandate={cancelMandateMutation.isPending}
          />
        )}

        <TeacherSubscriptionAvailablePlans
            plansQuery={plansQuery}
            hasActiveSub={hasActiveSub}
            currentPlanId={statusQuery.data?.planId}
            subscriptionStatus={statusQuery.data?.status}
            isInitiatingPayment={isInitiatingPayment}
            onSelectPlan={handleSelectPlan}
            paymentMode={paymentMode}
            walletBalance={walletBalance}
            useWalletBalance={useWalletBalance}
            setUseWalletBalance={setUseWalletBalance}
          />

          <TeacherSubscriptionTransactionHistory
            historyQuery={historyQuery}
            historyPage={historyPage}
            onPageChange={setHistoryPage}
          />
      </div>

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
              <div className={styles.breakdownRow}>
                <span>Total Price:</span>
                <strong>₹{pendingPlan.price.toLocaleString("en-IN")}</strong>
              </div>

              {walletBalance > 0 && (
                <div className={styles.walletToggleRow}>
                  <label htmlFor="dialog-use-wallet">Use Wallet Balance (Available: ₹{walletBalance.toLocaleString("en-IN")})</label>
                  <Switch 
                    id="dialog-use-wallet" 
                    checked={useWalletBalance} 
                    onCheckedChange={setUseWalletBalance} 
                  />
                </div>
              )}

              {useWalletBalance && walletBalance > 0 ? (
                <>
                  <div className={styles.breakdownRow}>
                    <span>Wallet Deduction:</span>
                    <strong className={styles.successText}>-₹{Math.min(walletBalance, pendingPlan.price).toLocaleString("en-IN")}</strong>
                  </div>
                  <div className={styles.breakdownRow}>
                    <span>To Pay via PayU:</span>
                    {walletBalance >= pendingPlan.price ? (
                      <strong className={styles.successText}>No additional payment needed</strong>
                    ) : (
                      <strong>₹{(pendingPlan.price - walletBalance).toLocaleString("en-IN")}</strong>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.breakdownRow}>
                  <span>Full payment via PayU:</span>
                  <strong>₹{pendingPlan.price.toLocaleString("en-IN")}</strong>
                </div>
              )}

              <p className={styles.warningNote}>
                Wallet deductions are non-refundable and will be reflected in your transaction history.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlan(null)} disabled={isInitiatingPayment}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubscription} disabled={isInitiatingPayment}>
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