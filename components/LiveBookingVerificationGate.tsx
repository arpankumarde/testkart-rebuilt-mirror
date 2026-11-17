import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Input } from "./Input";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { AUTH_QUERY_KEY, useAuth } from "../helpers/useAuth";
import type { User } from "../helpers/User";
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import { useSendOtpMutation, useVerifyOtpMutation } from "../helpers/useMobileVerification";
import { useSendEmailOtpMutation, useVerifyEmailOtpMutation } from "../helpers/useEmailVerification";
import { isEmailVerified, isMobileVerified, LiveBookingVerificationContext } from "../helpers/useLiveBookingGate";
import styles from "./LiveBookingVerificationGate.module.css";

const RESEND_COOLDOWN_SECONDS = 30;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "mobile" | "email";

const isContactVerified = (user: User) => isEmailVerified(user) && isMobileVerified(user);

/**
 * Supplies useLiveBookingGate. Before a student books a 1:1 trial, a 1:1 package or a live
 * course, one popup verifies whichever of mobile number and email address is not verified
 * yet. Guests, teachers and impersonating admins pass straight through; the booking endpoints
 * still refuse an unverified account.
 */
export const LiveBookingVerificationGateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const authRef = useRef(authState);
  authRef.current = authState;
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const ensure = useCallback(async () => {
    const auth = authRef.current;
    if (auth.type !== "authenticated" || auth.user.role !== "student" || auth.impersonatorAdminId) return true;
    if (isContactVerified(auth.user)) return true;

    // The cached session never goes stale, so a verification finished in another tab is picked up here.
    try {
      await queryClient.refetchQueries({ queryKey: AUTH_QUERY_KEY });
    } catch {
      // Fall through to the popup, which reads the same session.
    }
    const fresh = queryClient.getQueryData<{ user: User } | null>(AUTH_QUERY_KEY);
    if (fresh?.user && isContactVerified(fresh.user)) return true;

    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, [queryClient]);

  return (
    <LiveBookingVerificationContext.Provider value={ensure}>
      {children}
      {open && authState.type === "authenticated" && (
        <LiveBookingVerificationDialog user={authState.user} onDone={() => finish(true)} onCancel={() => finish(false)} />
      )}
    </LiveBookingVerificationContext.Provider>
  );
};

const LiveBookingVerificationDialog: React.FC<{ user: User; onDone: () => void; onCancel: () => void }> = ({
  user,
  onDone,
  onCancel,
}) => {
  const mobileDone = isMobileVerified(user);
  const emailDone = isEmailVerified(user);
  const step: Step | null = !mobileDone ? "mobile" : !emailDone ? "email" : null;

  const [phase, setPhase] = useState<"input" | "otp">("input");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  const sendMobileOtp = useSendOtpMutation();
  const verifyMobileOtp = useVerifyOtpMutation();
  const sendEmailOtp = useSendEmailOtpMutation();
  const verifyEmailOtp = useVerifyEmailOtpMutation();
  const busy = sendMobileOtp.isPending || verifyMobileOtp.isPending || sendEmailOtp.isPending || verifyEmailOtp.isPending;

  // Each step starts on its input, filled with the unverified value already on the account.
  useEffect(() => {
    setPhase("input");
    setOtp("");
    setError(null);
    setValue(step === "mobile" ? (user.mobileNumber ?? "").replace(/\D/g, "").slice(-10) : step === "email" ? (user.email ?? "") : "");
    // Only a change of step resets the form; the session refetch after a send must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Both verified: the session refresh after the last OTP lands here and the booking carries on.
  useEffect(() => {
    if (step === null) onDone();
  }, [step, onDone]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  useEffect(() => {
    if (phase === "otp") otpRef.current?.focus();
  }, [phase]);

  if (step === null) return null;

  const send = () => {
    setError(null);
    const target = value.trim();
    if (step === "mobile" && !MOBILE_PATTERN.test(target)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (step === "email" && !EMAIL_PATTERN.test(target)) {
      setError("Enter a valid email address.");
      return;
    }
    const onSuccess = () => {
      setValue(target);
      setOtp("");
      setPhase("otp");
      setResendTimer(RESEND_COOLDOWN_SECONDS);
    };
    const onError = (err: Error) => setError(err.message);
    if (step === "mobile") sendMobileOtp.mutate({ mobileNumber: target }, { onSuccess, onError });
    else sendEmailOtp.mutate({ email: target }, { onSuccess, onError });
  };

  const verify = () => {
    setError(null);
    const length = step === "mobile" ? 4 : 6;
    if (!new RegExp(`^\\d{${length}}$`).test(otp)) {
      setError(`Enter the ${length}-digit code.`);
      return;
    }
    const onError = (err: Error) => {
      setError(err.message);
      setOtp("");
    };
    if (step === "mobile") verifyMobileOtp.mutate({ mobileNumber: value, otpCode: otp }, { onError });
    else verifyEmailOtp.mutate({ email: value, otpCode: otp }, { onError });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (phase === "input") send();
    else verify();
  };

  const codeLength = step === "mobile" ? 4 : 6;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Verify your contact details</DialogTitle>
          <DialogDescription>
            Your teacher gets your verified email address and mobile number for every live class. You only need to do
            this once.
          </DialogDescription>
        </DialogHeader>

        <ul className={styles.statusList}>
          <li className={`${styles.statusRow} ${step === "mobile" ? styles.statusRowActive : ""}`}>
            <span className={styles.statusLabel}>Mobile number</span>
            <Badge variant={mobileDone ? "success" : "warning"}>{mobileDone ? "Verified" : "Not verified"}</Badge>
          </li>
          <li className={`${styles.statusRow} ${step === "email" ? styles.statusRowActive : ""}`}>
            <span className={styles.statusLabel}>Email address</span>
            <Badge variant={emailDone ? "success" : "warning"}>{emailDone ? "Verified" : "Not verified"}</Badge>
          </li>
        </ul>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {error && <p className={styles.formError}>{error}</p>}

          {phase === "input" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="live-booking-contact">
                {step === "mobile" ? "Mobile number" : "Email address"}
              </label>
              {step === "mobile" ? (
                <div className={styles.phoneRow}>
                  <span className={styles.phonePrefix}>+91</span>
                  <Input
                    id="live-booking-contact"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit mobile number"
                    autoFocus
                    value={value}
                    disabled={busy}
                    onChange={(e) => {
                      setValue(sanitizeMobileInput(e.target.value));
                      setError(null);
                    }}
                  />
                </div>
              ) : (
                <Input
                  id="live-booking-contact"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  autoFocus
                  value={value}
                  disabled={busy}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <p className={styles.otpInfo}>
                Enter the {codeLength}-digit code sent to {step === "mobile" ? `+91 ${value}` : value}.{" "}
                <Button
                  type="button"
                  variant="link"
                  className={styles.inlineLink}
                  disabled={busy}
                  onClick={() => {
                    setPhase("input");
                    setOtp("");
                    setError(null);
                  }}
                >
                  Change
                </Button>
              </p>
              <label className={styles.label} htmlFor="live-booking-otp">
                Verification code
              </label>
              <Input
                id="live-booking-otp"
                ref={otpRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={codeLength}
                value={otp}
                disabled={busy}
                className={styles.otpInput}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, codeLength));
                  setError(null);
                }}
              />
              <div className={styles.resendRow}>
                <Button
                  type="button"
                  variant="link"
                  className={styles.inlineLink}
                  disabled={busy || resendTimer > 0}
                  onClick={send}
                >
                  Resend code
                </Button>
                {resendTimer > 0 && <span className={styles.timer}>in {resendTimer}s</span>}
              </div>
            </div>
          )}

          <Button type="submit" disabled={busy} className={styles.submitButton}>
            {busy ? (
              <span className={styles.loadingText}>
                <Spinner className={styles.spinner} size="sm" />
                {phase === "input" ? "Sending code..." : "Verifying..."}
              </span>
            ) : phase === "input" ? (
              "Send code"
            ) : step === "mobile" ? (
              "Verify mobile number"
            ) : (
              "Verify email address"
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} className={styles.cancelButton}>
            Cancel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
