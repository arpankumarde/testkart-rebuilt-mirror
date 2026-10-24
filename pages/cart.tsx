import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShoppingCart, AlertCircle } from "lucide-react";
import { useCartItemsQuery, useRemoveFromCartMutation } from "../helpers/useCartQuery";
import { useInitiatePaymentMutation } from "../helpers/usePaymentQuery";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useStudentWalletPurchase } from "../helpers/useStudentWalletPurchase";
import { useAuth } from "../helpers/useAuth";
import { trackGTMEvent } from "../helpers/trackGTMEvent";
import { Button } from "../components/Button";
import { CartItem, CartItemSkeleton } from "../components/CartItem";
import { CartOrderSummary } from "../components/CartOrderSummary";
import { SpinWinCouponPicker } from "../components/SpinWinCouponPicker";
import { TcoinsCheckoutOption, tcoinsToSpend } from "../components/TcoinsCheckoutOption";
import { useStudentTcoins } from "../helpers/useTcoins";
import { useValidatePromoCodeMutation } from "../helpers/usePromoCodeMutations";
import { paymentFailureReason } from "../helpers/paymentFailureReason";
import styles from "./cart.module.css";

const CartPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string;
    promoCodeId: number;
    discountAmount: number;
    eligibleItemIds: number[];
  } | null>(null);
  const [wantsTcoins, setWantsTcoins] = useState(false);

  const { data, isLoading, isError, error } = useCartItemsQuery();
  const { mutate: removeFromCart, isPending: isRemoving } = useRemoveFromCartMutation();
  const { mutate: initiatePayment, isPending: isInitiatingPayment } = useInitiatePaymentMutation();
  const { data: walletData } = useStudentWalletBalance();
  const { mutate: purchaseWithWallet, isPending: isWalletProcessing } = useStudentWalletPurchase();
  const { mutate: validateCode, isPending: isValidatingCode } = useValidatePromoCodeMutation();
  const { data: tcoins } = useStudentTcoins(isStudent);

  // Handle URL messages (payment failure, cancellation, etc.)
  useEffect(() => {
    const cancelled = searchParams.get("cancelled");
    const status = searchParams.get("status");
    const errorParam = searchParams.get("error");

    if (cancelled === "true") {
      toast.error("Payment was cancelled. You can try again.");
      searchParams.delete("cancelled");
      searchParams.delete("order_id");
      setSearchParams(searchParams, { replace: true });
    } else if (status === "failed") {
      const failure = paymentFailureReason.parse(searchParams.get("reason"));
      toast.error(failure ? `Payment failed. ${failure.payerMessage}` : "Payment failed. Please try again.");
      searchParams.delete("status");
      searchParams.delete("order_id");
      searchParams.delete("reason");
      setSearchParams(searchParams, { replace: true });
    } else if (errorParam) {
      const errorMap: Record<string, string> = {
        payment_config: "Payment configuration error.",
        invalid_hash: "Payment verification failed.",
        order_not_found: "Order not found.",
        processing_failed: "Payment processing failed.",
      };
      toast.error(errorMap[errorParam] || "An error occurred. Please try again.");
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }

    if (cancelled === "true" || status === "failed" || errorParam) {
      setAppliedPromoCode(null);
    }
  }, [searchParams, setSearchParams]);

  // Calculations
  const subtotal = data?.items.reduce((acc, item) => acc + item.price, 0) ?? 0;
  const itemDiscounts = data?.items.reduce((acc, item) => acc + (item.price - (item.discountPrice ?? item.price)), 0) ?? 0;
  const promoDiscount = appliedPromoCode?.discountAmount ?? 0;
  
  // Total logic: (Price - ItemDiscount) - PromoDiscount
  const totalBeforePromo = subtotal - itemDiscounts;
  const totalBeforeTcoins = Math.max(0, totalBeforePromo - promoDiscount);
  const tcoinsUsed = tcoinsToSpend(tcoins, totalBeforePromo, wantsTcoins, appliedPromoCode !== null);
  const finalTotal = Math.max(0, Math.round((totalBeforeTcoins - tcoinsUsed) * 100) / 100);

  // Promo Code Input Props
  const promoInputItems = data?.items.map(item => {
    const id = item.type === 'test' ? item.mockTestId : 
               item.type === 'course' ? item.courseId : 
               item.digitalProductId;
    
    // Mapping types loosely for promo compatibility if needed, though schema usually handles exact match
    const type = item.type === 'digitalProduct' ? 'digital_product' : item.type; 

    return {
      id,
      type: type as 'test' | 'course' | 'digital_product', 
      price: item.discountPrice ?? item.price,
    };
  }) ?? [];

  const handlePromoApply = (
    promoCodeId: number, 
    discountAmount: number, 
    code: string, 
    eligibleItemIds: number[]
  ) => {
    // Coins never combine with a coupon, so applying one turns them off.
    setWantsTcoins(false);
    setAppliedPromoCode({
      code,
      promoCodeId,
      discountAmount,
      eligibleItemIds,
    });
    toast.success(`Coupon applied successfully! You saved ₹${discountAmount.toFixed(2).replace(/\.00$/, "")} on this order.`);
  };

  const handlePromoRemove = () => {
    setAppliedPromoCode(null);
    toast.info("Coupon removed");
  };

  // Applying from the coupon list goes through the same server validation as a typed code.
  const applyCouponCode = (code: string) => {
    if (appliedPromoCode) {
      toast.error(`${appliedPromoCode.code} is already applied. Remove it first; only one coupon works per order.`);
      return;
    }
    validateCode(
      { code, items: promoInputItems, totalAmount: totalBeforePromo },
      {
        onSuccess: (result) => {
          if (result.valid && result.promoCodeId && result.discountAmount) {
            handlePromoApply(result.promoCodeId, result.discountAmount, code, result.eligibleItemIds ?? []);
          } else {
            toast.error(result.message);
          }
        },
      }
    );
  };

  const handlePayment = () => {
    initiatePayment({
      promoCodeId: appliedPromoCode?.promoCodeId,
      useTcoins: tcoinsUsed > 0,
    });
  };

  const handleWalletPayment = () => {
    purchaseWithWallet({
      promoCodeId: appliedPromoCode?.promoCodeId,
      useTcoins: tcoinsUsed > 0,
    }, {
      onSuccess: (data) => {
        toast.success(`Purchase successful! ₹${data.amountDeducted} deducted from wallet.`);
        trackGTMEvent({
          event: 'purchase',
          transaction_id: String(data.orderId),
          value: data.amountDeducted,
          currency: 'INR',
          payment_method: 'wallet'
        });
        navigate(`/student/dashboard?order_id=${data.orderId}&wallet=true`);
      },
      onError: (err) => {
        toast.error(err.message || "Wallet purchase failed. Please try again.");
      }
    });
  };

  // Content Rendering
  const renderCartContent = () => {
    if (isLoading) {
      return (
        <div className={styles.itemsList}>
          <CartItemSkeleton />
          <CartItemSkeleton />
          <CartItemSkeleton />
        </div>
      );
    }

    if (isError) {
      return (
        <div className={styles.emptyState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Error Loading Cart</h2>
          <p>{error instanceof Error ? error.message : "Could not load your cart items."}</p>
          <Button asChild variant="outline">
            <Link to="/mock-test">Browse Tests</Link>
          </Button>
        </div>
      );
    }

    if (!data || data.items.length === 0) {
      return (
        <div className={styles.emptyState}>
          <ShoppingCart size={48} className={styles.emptyIcon} />
          <h2>Your Cart is Empty</h2>
          <p>Looks like you haven't added any items yet.</p>
          <Button asChild>
            <Link to="/mock-test">Start Browsing</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.cartLayout}>
        <div className={styles.itemsColumn}>
          <div className={styles.itemsHeader}>
            <h2>Shopping Cart <span>({data.items.length} items)</span></h2>
          </div>
          
          <div className={styles.itemsList}>
            {data.items.map((item) => {
              // Determine ID for promo checking
              const id = item.type === 'test' ? item.mockTestId : 
                         item.type === 'course' ? item.courseId : 
                         item.digitalProductId;

              return (
                <CartItem
                  key={item.cartItemId}
                  item={item}
                  onRemove={(cartItemId) => removeFromCart({ cartItemId })}
                  isRemoving={isRemoving}
                  isEligibleForPromo={appliedPromoCode?.eligibleItemIds.includes(id)}
                />
              );
            })}
          </div>
        </div>

        <div className={styles.summaryColumn}>
          <div className={styles.stickySummary}>
            <CartOrderSummary
              subtotal={subtotal}
              itemDiscounts={itemDiscounts}
              promoDiscount={promoDiscount}
              finalTotal={finalTotal}
              onProceed={handlePayment}
              isProcessing={isInitiatingPayment}
              appliedPromoCode={appliedPromoCode?.code}
              walletBalance={isStudent ? walletData?.availableBalance : undefined}
              onPayWithWallet={handleWalletPayment}
              isWalletProcessing={isWalletProcessing}
              tcoinsUsed={tcoinsUsed}
              tcoinsOption={
                tcoins?.enabled ? (
                  <TcoinsCheckoutOption
                    summary={tcoins}
                    orderValue={totalBeforePromo}
                    amountToPay={finalTotal}
                    checked={wantsTcoins}
                    onCheckedChange={setWantsTcoins}
                    couponApplied={appliedPromoCode !== null}
                  />
                ) : undefined
              }
              couponPicker={
                isStudent ? (
                  <SpinWinCouponPicker
                    items={promoInputItems}
                    appliedCode={appliedPromoCode?.code}
                    onApply={applyCouponCode}
                    isApplying={isValidatingCode}
                  />
                ) : undefined
              }
              promoInputProps={{
                items: promoInputItems,
                totalAmount: totalBeforePromo,
                onApply: handlePromoApply,
                onRemove: handlePromoRemove,
                appliedDiscount: appliedPromoCode ? {
                  code: appliedPromoCode.code,
                  amount: appliedPromoCode.discountAmount,
                } : undefined,
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Shopping Cart | Testkart</title>
        <meta name="description" content="Review items in your shopping cart and proceed to checkout." />
      </Helmet>
      
      <div className={styles.pageContainer}>
        {renderCartContent()}
      </div>
    </>
  );
};

export default CartPage;