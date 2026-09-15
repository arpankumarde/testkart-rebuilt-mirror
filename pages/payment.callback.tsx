import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Spinner } from "../components/Spinner";
import { postPaymentPayuVerifyAndComplete } from "../endpoints/payment/payu/verify-and-complete_POST.schema";
import { postPaymentPayuSubscriptionVerifyAndComplete } from "../endpoints/payment/payu/subscription/verify-and-complete_POST.schema";
import { toast } from "sonner";
import styles from "./payment.callback.module.css";

const POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLLING_TIME = 30000; // 30 seconds

type PaymentType = "order" | "subscription";

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Verifying your payment...");
  const [isPolling, setIsPolling] = useState(false);
  
  // Use refs to track polling state to avoid closure staleness in setTimeout/intervals
  const pollingStartTimeRef = useRef<number>(0);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in strict mode
    if (hasVerifiedRef.current) return;
    
    const txnid = searchParams.get("txnid");
    // 'type' param distinguishes between regular orders and subscription payments
    // default to 'order' for backward compatibility if not present
    const type = (searchParams.get("type") as PaymentType) || "order"; 
    
    // If no txnid, something is wrong
    if (!txnid) {
      console.error("Missing txnid in callback params");
      toast.error("Invalid payment callback parameters");
      handleRedirect(type, "error", "invalid_callback");
      return;
    }

    hasVerifiedRef.current = true;
    verifyPayment(txnid, type);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedirect = (
    type: PaymentType, 
    status: "success" | "failed" | "pending_timeout" | "error", 
    details?: string | number
  ) => {
    if (type === "subscription") {
      if (status === "success") {
        toast.success("Subscription activated successfully!");
        navigate("/teacher/subscription?status=success", { replace: true });
      } else {
        // failed, pending_timeout, error
        const errorMsg = details && typeof details === 'string' ? details : "payment_failed";
        toast.error(status === "pending_timeout" ? "Payment processing is taking longer than expected." : "Subscription payment failed.");
        navigate(`/teacher/subscription?status=failed&error=${errorMsg}`, { replace: true });
      }
    } else {
      // Regular order
      if (status === "success") {
        toast.success("Payment successful!");
        navigate(`/order/${details}?status=success`, { replace: true });
      } else if (status === "pending_timeout") {
        toast.warning("Payment is taking longer than expected. Please check your order history.");
        navigate("/student/orders?status=pending_timeout", { replace: true });
      } else {
        // failed or error
        const errorMsg = details && typeof details === 'string' ? details : "payment_failed";
        toast.error("Payment failed or verification error.");
        navigate(`/cart?error=${errorMsg}`, { replace: true });
      }
    }
  };

  const verifyPayment = async (txnid: string, type: PaymentType) => {
    try {
      if (type === "subscription") {
        const result = await postPaymentPayuSubscriptionVerifyAndComplete({ txnid });
        
        if (result.success) {
          if (result.status === "completed") {
            handleRedirect(type, "success", result.subscriptionId || undefined);
          } else if (result.status === "failed") {
            toast.error(result.message || "Payment failed");
            handleRedirect(type, "failed", "payment_failed");
          } else if (result.status === "pending") {
             if (!isPolling) startPolling(txnid, type);
          }
        } else {
          toast.error(result.message || "Payment verification failed");
          handleRedirect(type, "failed", "verification_failed");
        }
      } else {
        // Regular order verification
        const result = await postPaymentPayuVerifyAndComplete({ txnid });

        if (result.success) {
          if (result.orderStatus === "completed") {
            handleRedirect(type, "success", result.orderId!);
          } else if (result.orderStatus === "failed") {
            toast.error(result.message || "Payment failed");
            handleRedirect(type, "failed", "payment_failed");
          } else if (result.orderStatus === "pending") {
            if (!isPolling) startPolling(txnid, type);
          }
        } else {
          toast.error(result.message || "Payment verification failed");
          handleRedirect(type, "failed", "verification_failed");
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Error verifying payment.");
      handleRedirect(type, "error", "network_error");
    }
  };

  const startPolling = (txnid: string, type: PaymentType) => {
    setIsPolling(true);
    setStatusMessage("Payment is being processed, please wait...");
    pollingStartTimeRef.current = Date.now();

    const poll = async () => {
      // Check if timeout reached
      if (Date.now() - pollingStartTimeRef.current > MAX_POLLING_TIME) {
        handleRedirect(type, "pending_timeout");
        return;
      }

      try {
        if (type === "subscription") {
          const result = await postPaymentPayuSubscriptionVerifyAndComplete({ txnid });
          
          if (result.success && result.status === "completed") {
            handleRedirect(type, "success", result.subscriptionId || undefined);
            return;
          } else if (result.success && result.status === "failed") {
            toast.error(result.message || "Payment failed");
            handleRedirect(type, "failed", "payment_failed");
            return;
          }
        } else {
          const result = await postPaymentPayuVerifyAndComplete({ txnid });
          
          if (result.success && result.orderStatus === "completed") {
            handleRedirect(type, "success", result.orderId!);
            return;
          } else if (result.success && result.orderStatus === "failed") {
            toast.error(result.message || "Payment failed");
            handleRedirect(type, "failed", "payment_failed");
            return;
          }
        }
        
        // Still pending, poll again
        setTimeout(poll, POLLING_INTERVAL);
      } catch (error) {
        // If polling fails, retry next time unless timeout
        setTimeout(poll, POLLING_INTERVAL);
      }
    };

    // Start the first poll after delay
    setTimeout(poll, POLLING_INTERVAL);
  };

  return (
    <>
      <Helmet>
        <title>Verifying Payment | Testkart</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className={styles.container}>
        <div className={styles.card}>
          <Spinner size="lg" className={styles.spinner} />
          <h1 className={styles.title}>Processing Payment</h1>
          <p className={styles.message}>{statusMessage}</p>
          <p className={styles.subMessage}>Please do not close this window or press back.</p>
        </div>
      </div>
    </>
  );
}