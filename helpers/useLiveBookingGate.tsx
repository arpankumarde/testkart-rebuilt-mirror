import { createContext, useContext } from "react";
import type { User } from "./User";
import { usePurchaseDetailsGate, type EnsurePurchaseDetails } from "./usePurchaseDetailsGate";

/**
 * Live classes (1:1 trials, 1:1 packages and live courses) need a verified email address and
 * mobile number before checkout; the booking endpoints refuse without them
 * (helpers/liveBookingContact). Provided by LiveBookingVerificationGateProvider, which asks
 * for whichever is missing and resolves false when the student closes the popup.
 */
export type EnsureContactVerified = () => Promise<boolean>;

export const LIVE_BOOKING_VERIFICATION_MESSAGE = "Verify your email address and mobile number to book a live class.";

export class LiveBookingVerificationRequiredError extends Error {
  constructor() {
    super(LIVE_BOOKING_VERIFICATION_MESSAGE);
    this.name = "LiveBookingVerificationRequiredError";
  }
}

export const isEmailVerified = (user: Pick<User, "email" | "emailVerified">) => !!user.email && user.emailVerified === true;
export const isMobileVerified = (user: Pick<User, "mobileNumber" | "mobileVerified">) =>
  !!user.mobileNumber && user.mobileVerified === true;

export const LiveBookingVerificationContext = createContext<EnsureContactVerified>(() => Promise.resolve(true));

/** Verified contact first, then the name and billing state every paid checkout asks for. */
export const useLiveBookingGate = (): EnsurePurchaseDetails => {
  const ensureContact = useContext(LiveBookingVerificationContext);
  const ensureDetails = usePurchaseDetailsGate();
  return async () => {
    if (!(await ensureContact())) throw new LiveBookingVerificationRequiredError();
    return ensureDetails();
  };
};
