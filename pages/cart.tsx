import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, AlertCircle } from "lucide-react";
import { CART_QUERY_KEY, cartQuoteKey, useCartItemsQuery, useCartQuoteQuery, useRemoveFromCartMutation } from "../helpers/useCartQuery";
import { useInitiatePaymentMutation } from "../helpers/usePaymentQuery";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useStudentWalletPurchase } from "../helpers/useStudentWalletPurchase";
import { useAuth } from "../helpers/useAuth";
import { trackGTMEvent } from "../helpers/trackGTMEvent";
import { Button } from "../components/Button";
import { CartItem, CartItemSkeleton } from "../components/CartItem";
import { CartOrderSummary } from "../components/CartOrderSummary";
import { CartCouponPicker } from "../components/CartCouponPicker";
import { TcoinsCheckoutOption, tcoinsToSpend } from "../components/TcoinsCheckoutOption";
import { useStudentTcoins } from "../helpers/useTcoins";
import { paymentFailureReason } from "../helpers/paymentFailureReason";
import { describeOfferItems, formatOfferInr } from "../helpers/courseCouponOffer";
import { ONE_OFFER_MESSAGE, tcoinsRupeeValue } from "../helpers/tcoinsMath";
import { postCartQuote } from "../endpoints/cart/quote_POST.schema";
import { cartItemRef, priceCartItems } from "../helpers/cartItemPricing";
import { expiredCartMessage } from "../helpers/contentExpiry";
import styles from "./cart.module.css";

type ChosenCoupon = { promoCodeId: number; code: string };

const CartPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  // The one coupon the student picked or typed. Teacher offers are never stored here: the server applies them.
  const [chosen, setChosen] = useState<ChosenCoupon | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [wantsTcoins, setWantsTcoins] = useState(false);

  const { data, isLoading, isError, error } = useCartItemsQuery();
  const { mutate: removeFromCart, isPending: isRemoving } = useRemoveFromCartMutation();
  const { mutate: initiatePayment, isPending: isInitiatingPayment } = useInitiatePaymentMutation();
  const { data: walletData } = useStudentWalletBalance();
  const { mutate: purchaseWithWallet, isPending: isWalletProcessing } = useStudentWalletPurchase();
  const { data: tcoins } = useStudentTcoins(isStudent);
  const quoteQuery = useCartQuoteQuery(
    chosen?.promoCodeId ?? null,
    authState.type === "authenticated" && (data?.items.length ?? 0) > 0
  );
  const quote = quoteQuery.data;

  // The cart is cached for 15 minutes; a teacher offer can end sooner, so re-check on arrival.
  useEffect(() => {
    if (authState.type === "authenticated") {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    }
  }, [authState.type, queryClient]);

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
      setChosen(null);
    }
  }, [searchParams, setSearchParams]);

  // A cart change can make the chosen coupon stop fitting; drop it and say why. Teacher offers stay.
  useEffect(() => {
    if (!chosen || !quote || quoteQuery.isPlaceholderData || quoteQuery.isFetching) return;
    if (quote.chosen?.promoCodeId !== chosen.promoCodeId) {
      toast.error(quote.chosenError ?? `${chosen.code} no longer applies to this cart.`);
      setChosen(null);
    }
  }, [chosen, quote, quoteQuery.isPlaceholderData, quoteQuery.isFetching]);

  // Prices: list prices and sale prices come from the cart; every coupon figure comes from the quote.
  const items = data?.items ?? [];
  const expiredTitles = items.filter((item) => item.expired).map((item) => item.title);
  const blockedReason = expiredTitles.length > 0 ? expiredCartMessage(expiredTitles) : undefined;
  const totalBeforePromo = items.reduce((acc, item) => acc + (item.discountPrice ?? item.price), 0);
  const tcoinsUsed = tcoinsToSpend(tcoins, totalBeforePromo, wantsTcoins, chosen !== null);

  // Tcoins replace every coupon. Otherwise: teacher offers, plus the chosen coupon on top.
  const couponsActive = tcoinsUsed === 0;
  const allTeacherOffers = quote?.autoOffers ?? [];
  const teacherOffers = couponsActive ? allTeacherOffers : [];
  const chosenApplied =
    couponsActive && chosen && quote?.chosen?.promoCodeId === chosen.promoCodeId ? quote.chosen : null;

  // Checkout waits until the quote covers exactly the items on screen.
  const quoteMatchesCart =
    !!quote &&
    !quoteQuery.isPlaceholderData &&
    quote.lines.length === items.length &&
    items.every((item) => {
      const ref = cartItemRef(item);
      return quote.lines.some((l) => l.kind === ref.kind && l.id === ref.id);
    });
  const isPricing = items.length > 0 && !quoteMatchesCart;

  const pricedItems = priceCartItems(items, quoteMatchesCart ? quote?.lines : undefined, couponsActive);
  const roundPaise = (amount: number) => Math.round(amount * 100) / 100;
  const totalMrp = roundPaise(pricedItems.reduce((sum, p) => sum + p.mrp, 0));
  const saleDiscount = roundPaise(pricedItems.reduce((sum, p) => sum + p.saleDiscount, 0));
  const teacherDiscount = roundPaise(pricedItems.reduce((sum, p) => sum + p.teacherDiscount, 0));
  const couponDiscount = chosenApplied?.discountAmount ?? 0;
  const tcoinsValue = tcoinsRupeeValue(tcoinsUsed);
  const finalTotal = Math.max(0, roundPaise(totalMrp - saleDiscount - teacherDiscount - couponDiscount - tcoinsValue));
  const totalSavings = Math.max(0, roundPaise(totalMrp - finalTotal));

  const offerNote = (() => {
    if (tcoinsUsed > 0 && allTeacherOffers.length > 0) {
      const codes = allTeacherOffers.map((o) => o.code).join(", ");
      const saving = formatOfferInr(allTeacherOffers.reduce((sum, o) => sum + o.discountAmount, 0));
      return `Tcoins replace the teacher offer ${codes}, which saves ${saving}. Untick Tcoins to get it back.`;
    }
    const replaced = chosenApplied?.replacesAutoOnItems ?? [];
    if (chosenApplied && replaced.length > 0) {
      const items = describeOfferItems(
        replaced.filter((i) => i.kind === "course").length,
        replaced.filter((i) => i.kind === "digitalProduct").length
      );
      return `${chosenApplied.code} replaces the teacher offer on ${items}. Remove it to get the offer back.`;
    }
    return undefined;
  })();

  const promoInputItems = data?.items.map(item => {
    const id = item.type === 'test' ? item.mockTestId :
               item.type === 'course' ? item.courseId :
               item.digitalProductId;
    const type = item.type === 'digitalProduct' ? 'digital_product' : item.type;
    return {
      id,
      type: type as 'test' | 'course' | 'digital_product',
      price: item.discountPrice ?? item.price,
    };
  }) ?? [];

  /**
   * Prices a coupon on the server against this cart, teacher offers included, and
   * applies it when it fits. Resolves to an error message, or null once applied.
   */
  const applyCoupon = async (ref: { promoCodeId?: number; code?: string }): Promise<string | null> => {
    const result = await postCartQuote(ref);
    if (!result.chosen) {
      return result.chosenError ?? "This coupon cannot be used on this cart.";
    }
    queryClient.setQueryData(cartQuoteKey(result.chosen.promoCodeId), result);
    const replacedTcoins = tcoinsUsed > 0;
    const replaced = chosen && chosen.promoCodeId !== result.chosen.promoCodeId ? chosen.code : null;
    setWantsTcoins(false);
    setChosen({ promoCodeId: result.chosen.promoCodeId, code: result.chosen.code });

    const saving = formatOfferInr(result.chosen.discountAmount);
    const lead = replacedTcoins
      ? `${result.chosen.code} applied in place of Tcoins.`
      : replaced
        ? `${result.chosen.code} applied in place of ${replaced}.`
        : `${result.chosen.code} applied.`;
    toast.success(
      result.autoOffers.length > 0 && result.chosen.replacesAutoOnItems.length === 0
        ? `${lead} You save ${saving} more on top of the teacher offer.`
        : `${lead} You save ${saving} on this order.`
    );
    return null;
  };

  const applyFromList = (coupon: ChosenCoupon) => {
    setApplyingId(coupon.promoCodeId);
    applyCoupon({ promoCodeId: coupon.promoCodeId })
      .then((message) => {
        if (message) toast.error(message);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "This coupon could not be applied."))
      .finally(() => setApplyingId(null));
  };

  // Ticking Tcoins while a coupon is applied swaps the coupon out instead of being blocked.
  const handleTcoinsChange = (checked: boolean) => {
    if (checked && chosen) {
      setChosen(null);
      toast.info(`${chosen.code} removed. ${ONE_OFFER_MESSAGE}`);
    }
    setWantsTcoins(checked);
  };

  const handlePromoRemove = () => {
    setChosen(null);
    toast.info(teacherOffers.length > 0 ? "Coupon removed. The teacher offer stays applied." : "Coupon removed");
  };

  // The server picks and prices the teacher offers itself; the ids only let it stop if one changed.
  const expectedAutoPromoCodeIds = tcoinsUsed > 0 ? undefined : teacherOffers.map((o) => o.promoCodeId);

  const handlePayment = () => {
    initiatePayment({
      promoCodeId: chosenApplied?.promoCodeId,
      useTcoins: tcoinsUsed > 0,
      autoPromoCodeIds: expectedAutoPromoCodeIds,
    });
  };

  const handleWalletPayment = () => {
    purchaseWithWallet({
      promoCodeId: chosenApplied?.promoCodeId,
      useTcoins: tcoinsUsed > 0,
      autoPromoCodeIds: expectedAutoPromoCodeIds,
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
        queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
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
            <h1 className={styles.heading}>Shopping Cart</h1>
            <span className={styles.itemCount}>
              {data.items.length} item{data.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className={styles.itemsList}>
            {data.items.map((item, index) => (
              <CartItem
                key={item.cartItemId}
                item={item}
                pricing={pricedItems[index]}
                onRemove={(cartItemId) => removeFromCart({ cartItemId })}
                isRemoving={isRemoving}
              />
            ))}
          </div>
        </div>

        <div className={styles.summaryColumn} id="cart-order-summary">
          <div className={styles.stickySummary}>
            <CartOrderSummary
              items={pricedItems}
              totals={{
                totalMrp,
                saleDiscount,
                teacherDiscount,
                couponDiscount,
                couponCode: chosenApplied?.code,
                tcoinsUsed,
                tcoinsValue,
                finalTotal,
              }}
              isPricing={isPricing}
              onProceed={handlePayment}
              isProcessing={isInitiatingPayment}
              hasTeacherOffers={teacherOffers.length > 0}
              chosenCoupon={chosenApplied ? { code: chosenApplied.code, amount: chosenApplied.discountAmount } : undefined}
              offerNote={offerNote}
              walletBalance={isStudent ? walletData?.availableBalance : undefined}
              onPayWithWallet={handleWalletPayment}
              isWalletProcessing={isWalletProcessing}
              blockedReason={blockedReason}
              tcoinsOption={
                tcoins?.enabled ? (
                  <TcoinsCheckoutOption
                    summary={tcoins}
                    orderValue={totalBeforePromo}
                    amountToPay={finalTotal}
                    checked={wantsTcoins}
                    onCheckedChange={handleTcoinsChange}
                    appliedCouponCode={chosen?.code ?? null}
                  />
                ) : undefined
              }
              couponPicker={
                isStudent ? (
                  <CartCouponPicker
                    quote={quote}
                    isLoading={quoteQuery.isLoading}
                    tcoinsActive={tcoinsUsed > 0}
                    onApply={applyFromList}
                    onRemove={handlePromoRemove}
                    applyingId={applyingId}
                  />
                ) : undefined
              }
              promoInputProps={{
                items: promoInputItems,
                totalAmount: totalBeforePromo,
                onApply: () => {},
                onSubmitCode: (code) => applyCoupon({ code }),
                onRemove: handlePromoRemove,
                appliedDiscount: chosenApplied ? {
                  code: chosenApplied.code,
                  amount: chosenApplied.discountAmount,
                } : undefined,
              }}
            />
          </div>
        </div>

        <div className={styles.mobileBar} role="region" aria-label="Checkout">
          <div className={styles.mobileBarTotals}>
            {isPricing ? (
              <span className={styles.mobileBarAmount}>Updating price...</span>
            ) : (
              <>
                <span className={styles.mobileBarAmount}>{formatOfferInr(finalTotal)}</span>
                {totalSavings > 0 ? (
                  <span className={styles.mobileBarSavings}>You save {formatOfferInr(totalSavings)}</span>
                ) : null}
              </>
            )}
            <a href="#cart-order-summary" className={styles.mobileBarLink}>View details</a>
          </div>
          <Button
            className={styles.mobileBarButton}
            onClick={handlePayment}
            disabled={isInitiatingPayment || isPricing || !!blockedReason}
          >
            {isInitiatingPayment ? "Processing..." : finalTotal === 0 && !isPricing ? "Complete Order" : "Proceed to Pay"}
          </Button>
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

      <div className={`${styles.page} ${items.length > 0 ? styles.pageWithBar : ""}`}>
        <div className={styles.pageContainer}>
          {renderCartContent()}
        </div>
      </div>
    </>
  );
};

export default CartPage;
