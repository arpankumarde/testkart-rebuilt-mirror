import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getOrdersDetails, type ItemType } from "../endpoints/orders/details_GET.schema";
import { postPaymentPayuVerifyAndComplete } from "../endpoints/payment/payu/verify-and-complete_POST.schema";
import { trackGTMEvent } from "../helpers/trackGTMEvent";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import { AlertCircle, CheckCircle, IndianRupee, Package, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { BRAND_APP_ICON } from "../helpers/brandAssets";
import styles from "./order.$orderId.module.css";

const OrderDetailsSkeleton: React.FC = () => (
  <div className={styles.page}>
    <header className={styles.header}>
      <Skeleton style={{ width: '300px', height: '2.5rem' }} />
      <Skeleton style={{ width: '200px', height: '1.25rem', marginTop: 'var(--spacing-2)' }} />
    </header>
    <div className={styles.content}>
      <div className={styles.itemsList}>
        <Skeleton style={{ width: '100%', height: '80px' }} />
        <Skeleton style={{ width: '100%', height: '80px' }} />
      </div>
      <aside className={styles.summary}>
        <Skeleton style={{ width: '150px', height: '1.75rem', marginBottom: 'var(--spacing-6)' }} />
        <Skeleton style={{ width: '100%', height: '1rem' }} />
        <Skeleton style={{ width: '100%', height: '1rem' }} />
        <Skeleton style={{ width: '100%', height: '1.5rem', marginTop: 'var(--spacing-4)' }} />
      </aside>
    </div>
  </div>
);

const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const numericOrderId = Number(orderId);
  const paymentStatus = searchParams.get("status");
  const txnid = searchParams.get("txnid");
  
  // Track if order was initially pending to show success message on transition
  const [wasPending, setWasPending] = useState(false);
  const [showTransitionSuccess, setShowTransitionSuccess] = useState(false);
  
  // Track if immediate verification was attempted
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [verificationSucceeded, setVerificationSucceeded] = useState(false);
  
  // Track polling start time for timeout
  const pollingStartTime = useRef<number | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const trackedOrdersRef = useRef<Set<number>>(new Set());
  const enrollmentInvalidatedRef = useRef(false);
  
  const POLLING_INTERVAL = 3000; // 3 seconds
  const POLLING_TIMEOUT = 2 * 60 * 1000; // 2 minutes

  // Immediate verification mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: (params: { txnid?: string; orderId?: number }) => 
      postPaymentPayuVerifyAndComplete(params),
    onSuccess: (result) => {
      console.log('Payment verification result:', result);
      setVerificationAttempted(true);
      
      if (result.success && result.orderStatus === 'completed') {
        setVerificationSucceeded(true);
        setShowTransitionSuccess(true);
        toast.success('Payment verified! Your order has been confirmed.');
        // Refetch order data to show updated status
        queryClient.invalidateQueries({ queryKey: ["orders", numericOrderId] });
      } else if (result.success && result.orderStatus === 'pending') {
        // Payment still pending, will rely on polling
        console.log('Payment still pending after verification, will continue polling');
      } else {
        // Verification failed or payment failed
        console.error('Payment verification failed:', result.message);
        toast.error(result.message || 'Payment verification failed');
      }
    },
    onError: (error) => {
      console.error('Payment verification error:', error);
      setVerificationAttempted(true);
      toast.error('Failed to verify payment. Please wait while we check with the payment gateway.');
    },
  });

  // Attempt immediate verification on mount when returning from payment gateway
  useEffect(() => {
    if (paymentStatus === "success" && !verificationAttempted && (txnid || numericOrderId)) {
      console.log('Attempting immediate payment verification...');
      verifyPaymentMutation.mutate({
        txnid: txnid || undefined,
        orderId: numericOrderId,
      });
    }
  }, [paymentStatus, txnid, numericOrderId, verificationAttempted]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["orders", numericOrderId],
    queryFn: () => getOrdersDetails({ id: numericOrderId }),
    enabled: !isNaN(numericOrderId) && numericOrderId > 0,
    refetchInterval: (query) => {
      const orderData = query.state.data;
      
      // Don't poll if immediate verification succeeded
      if (verificationSucceeded) {
        return false;
      }
      
      // Don't poll if timed out
      if (pollingTimedOut) {
        return false;
      }
      
      // Check if we've exceeded timeout
      if (pollingStartTime.current) {
        const elapsedTime = Date.now() - pollingStartTime.current;
        if (elapsedTime > POLLING_TIMEOUT) {
          setPollingTimedOut(true);
          console.log('Order status polling timed out after 2 minutes');
          return false;
        }
      }
      
      // Only poll if order is pending AND verification was either not attempted or failed
      if (orderData && orderData.status.toLowerCase() === 'pending') {
        // If we're still verifying, don't start polling yet
        if (verifyPaymentMutation.isPending) {
          return false;
        }
        
        if (!pollingStartTime.current) {
          pollingStartTime.current = Date.now();
          console.log('Started polling for order status (as fallback)');
        }
        return POLLING_INTERVAL;
      }
      
      return false;
    },
  });
  
  useEffect(() => {
    if (data && data.status.toLowerCase() === "completed" && (showTransitionSuccess || verificationSucceeded) && !trackedOrdersRef.current.has(data.id)) {
      trackGTMEvent({
        event: 'purchase',
        transaction_id: String(data.id),
        value: data.totalAmount,
        currency: 'INR',
        items: data.items.map(item => ({
          item_name: item.title,
          price: item.priceAtPurchase
        }))
      });
      trackedOrdersRef.current.add(data.id);
    }
  }, [data, showTransitionSuccess, verificationSucceeded]);

  // Track when order transitions from pending to completed
  useEffect(() => {
    if (data) {
      if (data.status.toLowerCase() === 'pending') {
        setWasPending(true);
      } else if (wasPending && data.status.toLowerCase() === 'completed') {
        // Order transitioned from pending to completed
        console.log('Order status changed from pending to completed');
        setShowTransitionSuccess(true);
        toast.success('Payment verified! Your order has been confirmed.');
      }
    }
  }, [data, wasPending]);

  // Once an order is confirmed completed, the public product detail pages for
  // the purchased items (mock test / course / bundle / digital product) may
  // still have a cached "not enrolled" response from before the purchase —
  // refetchOnMount is disabled globally (see _globalContextProviders.tsx) and
  // these detail queries use a 10-minute staleTime, so without an explicit
  // invalidation here the student would keep seeing "not enrolled" on those
  // pages until the cache naturally expires. Invalidate only the query-key
  // namespaces for item types actually present in this order.
  useEffect(() => {
    if (data && data.status.toLowerCase() === 'completed' && !enrollmentInvalidatedRef.current) {
      enrollmentInvalidatedRef.current = true;
      const itemTypes = new Set(data.items.map((item) => item.itemType));
      if (itemTypes.has('test')) {
        queryClient.invalidateQueries({ queryKey: ['tests', 'details'] });
      }
      if (itemTypes.has('course')) {
        queryClient.invalidateQueries({ queryKey: ['public', 'courses', 'details'] });
      }
      if (itemTypes.has('bundle')) {
        queryClient.invalidateQueries({ queryKey: ['public', 'bundles', 'details'] });
      }
      if (itemTypes.has('product')) {
        queryClient.invalidateQueries({ queryKey: ['shop', 'product'] });
      }
    }
  }, [data, queryClient]);

  // Clean up URL parameters after verification attempt
  useEffect(() => {
    if (verificationAttempted && paymentStatus) {
      // Clean up the URL by removing the status and txnid parameters
      searchParams.delete("status");
      searchParams.delete("txnid");
      setSearchParams(searchParams, { replace: true });
    }
  }, [verificationAttempted, paymentStatus, searchParams, setSearchParams]);

  // Determine the page title safely
  const pageTitle = !isNaN(numericOrderId) && numericOrderId > 0 
    ? `Order #${numericOrderId} | Testkart`
    : "Order Details | Testkart";

  if (isNaN(numericOrderId) || numericOrderId <= 0) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content="Order details for your Testkart purchase." />
        </Helmet>
        <div className={styles.centeredState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Invalid Order ID</h2>
          <p>The order ID in the URL is not valid.</p>
          <Button asChild variant="outline">
            <Link to="/student/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={`Details for your order #${numericOrderId}.`} />
        </Helmet>
        <OrderDetailsSkeleton />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={`Details for your order #${numericOrderId}.`} />
        </Helmet>
        <div className={styles.centeredState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Error Loading Order</h2>
          <p>{error instanceof Error ? error.message : "Could not load your order details."}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={`Details for your order #${numericOrderId}.`} />
        </Helmet>
        <div className={styles.centeredState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>No Order Data</h2>
          <p>Could not load order details.</p>
        </div>
      </>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const formattedTotal = formatCurrency(data.totalAmount);
  const hasDiscount = data.discountAmount > 0;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusMessage = (status: string) => {
    const failure = data.paymentFailure;
    if (failure?.reason === "payment_captured") {
      return {
        icon: <AlertTriangle size={20} />,
        text: failure.message,
        className: styles.warningMessage,
      };
    }
    switch (status.toLowerCase()) {
      case "pending":
        return {
          icon: <AlertTriangle size={20} />,
          text: "Payment pending. Return to checkout to complete payment.",
          className: styles.warningMessage,
        };
      case "failed":
        return {
          icon: <XCircle size={20} />,
          text: failure ? `Payment failed. ${failure.message}` : "Payment failed. Please try again.",
          className: styles.errorMessage,
        };
      case "cancelled":
        return {
          icon: <AlertCircle size={20} />,
          text: failure && failure.reason !== "cancelled" ? `Payment was cancelled. ${failure.message}` : "Payment was cancelled.",
          className: styles.infoMessage,
        };
      default:
        return null;
    }
  };

  const getItemTypeLabel = (itemType: ItemType): string => {
    switch (itemType) {
      case "test": return "Mock Test";
      case "course": return "Course";
      case "product": return "Digital Product";
      case "bundle": return "Bundle";
      default: return "Item";
    }
  };

  const statusMessage = getStatusMessage(data.status);
  const showRetryButton =
    (data.status.toLowerCase() === "pending" || data.status.toLowerCase() === "failed") &&
    data.paymentFailure?.reason !== "payment_captured";
  const isPending = data.status.toLowerCase() === "pending";
  const isVerifying = verifyPaymentMutation.isPending || (isPending && isFetching && !pollingTimedOut);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Details for your order #${numericOrderId}.`} />
      </Helmet>
      <div className={styles.page}>
        {((paymentStatus === "success" && !verifyPaymentMutation.isPending) || showTransitionSuccess) && data.status.toLowerCase() === "completed" && (
          <div className={styles.successBanner}>
            <CheckCircle size={24} />
            <div>
              <strong>Payment Successful!</strong>
              <p>Your payment has been processed and your order is confirmed.</p>
            </div>
          </div>
        )}
        {isVerifying && (
          <div className={styles.verifyingBanner}>
            <Spinner size="md" />
            <div>
              <strong>Verifying Payment...</strong>
              <p>Please wait while we confirm your payment with the payment gateway.</p>
            </div>
          </div>
        )}
        {pollingTimedOut && isPending && (
          <div className={styles.timeoutBanner}>
            <AlertTriangle size={24} />
            <div>
              <strong>Payment Verification Taking Longer Than Expected</strong>
              <p>We're still processing your payment. If your payment was successful, your order will be confirmed shortly. Please check back in a few minutes or contact support if the issue persists.</p>
            </div>
          </div>
        )}
        <header className={styles.header}>
          <div className={styles.headerIcon}>
            {data.status.toLowerCase() === "completed" ? (
              <CheckCircle size={32} />
            ) : (
              <Package size={32} />
            )}
          </div>
          <h1>
            {data.status.toLowerCase() === "completed"
              ? "Thank you for your order!"
              : isVerifying
                ? "Processing Your Order..."
                : "Order Details"}
          </h1>
          <p>
            {isVerifying 
              ? `Your order #${data.id} is being verified. This usually takes a few seconds.`
              : `Your order #${data.id} has been ${data.status.toLowerCase() === "completed" ? "confirmed" : "placed"}.`
            }
          </p>
        </header>
        {statusMessage && (
          <div className={statusMessage.className}>
            {statusMessage.icon}
            <p>{statusMessage.text}</p>
          </div>
        )}
        <div className={styles.content}>
          <div className={styles.itemsList}>
            <h2>Items Purchased</h2>
            {data.items.map(item => (
              <div key={item.orderItemId} className={styles.item}>
                <img
                  src={item.thumbnailUrl || BRAND_APP_ICON}
                  alt={item.title}
                  className={styles.itemImage}
                />
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemTitle}>{item.title}</h3>
                </div>
                <div className={styles.itemPrice}>
                  <IndianRupee size={16} />
                  <span>{item.priceAtPurchase.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <aside className={styles.summary}>
            <h2>Order Summary</h2>
            <div className={styles.summaryRow}>
              <span>Order ID:</span>
              <span>#{data.id}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Order Date:</span>
              <span>{data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Status:</span>
              <span>{getStatusBadge(data.status)}</span>
            </div>
            {data.paymentTransactionId && (
              <div className={styles.summaryRow}>
                <span>Transaction ID:</span>
                <span className={styles.transactionId}>{data.paymentTransactionId}</span>
              </div>
            )}
            {hasDiscount && (
              <>
                <div className={styles.summaryRow}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(data.subtotal)}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                  <span>Discount{data.promoCode ? ` (${data.promoCode})` : ""}:</span>
                  <span>-{formatCurrency(data.discountAmount)}</span>
                </div>
              </>
            )}
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span>{data.status.toLowerCase() === "completed" ? "Total Paid:" : "Total Amount:"}</span>
              <span>{formattedTotal}</span>
            </div>
            {showRetryButton && (
              <Button asChild size="lg" className={styles.dashboardButton}>
                <Link to="/checkout">
                  <IndianRupee size={18} />
                  Retry Payment
                </Link>
              </Button>
            )}
            {data.status.toLowerCase() === "completed" && (
              <Button asChild size="lg" className={styles.dashboardButton} variant="outline">
                <Link to="/student/dashboard">
                  <Package size={18} />
                  Go to My Tests
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </div>
    </>
  );
};

export default OrderConfirmationPage;