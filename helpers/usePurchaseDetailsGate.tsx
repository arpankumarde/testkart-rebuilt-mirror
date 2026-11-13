import { createContext, useContext } from "react";

/**
 * Resolves true once a signed-in student has a real name and a billing state
 * saved, asking for whichever is missing first; false when they close the
 * popup. Anyone else (guests, teachers, impersonating admins) passes straight
 * through. Provided by PurchaseDetailsGateProvider.
 *
 * Web only: the purchase endpoints do not require either field, so the mobile
 * app is unaffected.
 */
export type EnsurePurchaseDetails = () => Promise<boolean>;

export const PURCHASE_DETAILS_REQUIRED_MESSAGE = "Add your name and state to continue to payment.";

export class PurchaseDetailsRequiredError extends Error {
  constructor() {
    super(PURCHASE_DETAILS_REQUIRED_MESSAGE);
    this.name = "PurchaseDetailsRequiredError";
  }
}

export const PurchaseDetailsGateContext = createContext<EnsurePurchaseDetails>(() => Promise.resolve(true));

export const usePurchaseDetailsGate = (): EnsurePurchaseDetails => useContext(PurchaseDetailsGateContext);

/** Wraps a purchase call so it only runs after the gate passes. */
export const gatePurchase =
  <I, O>(ensure: EnsurePurchaseDetails, fn: (input: I) => Promise<O>) =>
  async (input: I): Promise<O> => {
    if (!(await ensure())) throw new PurchaseDetailsRequiredError();
    return fn(input);
  };
