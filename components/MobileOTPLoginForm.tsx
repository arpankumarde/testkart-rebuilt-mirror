import React, { useState, useRef, useEffect, useId } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { TurnstileWidget, TurnstileWidgetHandle } from "./TurnstileWidget";
import { useAuth } from "../helpers/useAuth";
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import { authErrorMessage } from "../helpers/authRequest";
import { useOtpSender } from "../helpers/useOtpSender";
import {
  useSendMobileOtpMutation,
  useVerifyMobileOtpMutation,
} from "../helpers/useMobileLogin";
import styles from "./MobileOTPLoginForm.module.css";

/** Synchronous, so the button state always matches what is in the field. */
function mobileValidationError(value: string): string | null {
  if (!value) return "Enter your mobile number";
  if (value.length !== 10) return "Mobile number must be 10 digits";
  return /^[6-9]\d{9}$/.test(value) ? null : "Please enter a valid 10-digit Indian mobile number";
}

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(4, "OTP must be 4 digits")
    .regex(/^\d{4}$/, "OTP must be 4 digits"),
});

type OtpFormData = z.infer<typeof otpSchema>;

interface MobileOTPLoginFormProps {
  className?: string;
  redirectPath?: string;
  role?: "user" | "teacher";
}

export const MobileOTPLoginForm: React.FC<MobileOTPLoginFormProps> = ({
  className,
  redirectPath = "/",
  role = "user",
}) => {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobileInput, setMobileInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const fieldId = useId();
  const otpInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const verifyingRef = useRef(false);

  const sender = useOtpSender(turnstileRef);
  const sendOtpMutation = useSendMobileOtpMutation();
  const verifyOtpMutation = useVerifyMobileOtpMutation();

  const otpForm = useForm({
    defaultValues: { otpCode: "" },
    schema: otpSchema,
  });

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const validationError = mobileValidationError(mobileInput);
  const isMobileValid = validationError === null;
  // A full-length number that cannot be Indian is flagged at once; a short
  // one only after the field loses focus, so typing is not interrupted.
  const showValidation =
    mobileInput !== "" && !isMobileValid && (touched || mobileInput.length === 10);
  const isVerifying = verifyOtpMutation.isPending;
  const isBusy = sender.isSending || isVerifying;

  const sendTo = (mobileNumber: string) =>
    sender.send((turnstileToken) => sendOtpMutation.mutateAsync({ mobileNumber, turnstileToken }));

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isMobileValid || isBusy) return;
    const mobileNumber = mobileInput;
    setNotice(null);
    if (await sendTo(mobileNumber)) {
      setSentTo(mobileNumber);
      otpForm.setValues({ otpCode: "" });
      setStep("otp");
    }
  };

  const handleResendOtp = async () => {
    if (sender.cooldownSeconds > 0 || isBusy) return;
    setNotice(null);
    if (await sendTo(sentTo)) {
      otpForm.setValues({ otpCode: "" });
      setNotice(`A new OTP has been sent to +91 ${sentTo}.`);
      otpInputRef.current?.focus();
    }
  };

  const handleVerifyOtp = (data: OtpFormData) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    sender.setError(null);
    setNotice(null);
    verifyOtpMutation.mutate(
      { mobileNumber: sentTo, otpCode: data.otpCode, role },
      {
        onSuccess: (result) => {
          onLogin(result.user);
          setTimeout(() => navigate(redirectPath), 200);
        },
        onError: (err) => {
          sender.setError(authErrorMessage(err));
          otpForm.setValues({ otpCode: "" });
          otpInputRef.current?.focus();
        },
        onSettled: () => {
          verifyingRef.current = false;
        },
      }
    );
  };

  const errorBox = sender.error ? (
    <div className={styles.errorMessage} role="alert">
      {sender.error}
    </div>
  ) : null;

  const offlineNote = !sender.isOnline ? (
    <p className={styles.offlineNote} role="status">
      You're offline. Reconnect to receive your OTP.
    </p>
  ) : null;

  const sendingLabel = sender.awaitingChallenge ? "Complete the check below" : "Sending OTP...";

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {step === "mobile" && (
        <form onSubmit={handleSendOtp} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor={fieldId} className={styles.label}>
              Mobile Number
            </label>
            <Input
              id={fieldId}
              placeholder="Enter your 10-digit mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              enterKeyHint="send"
              disabled={sender.isSending}
              value={mobileInput}
              onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
              onBlur={() => setTouched(true)}
              aria-invalid={showValidation}
              aria-describedby={`${fieldId}-message`}
              className={showValidation ? styles.inputInvalid : undefined}
            />
            <p id={`${fieldId}-message`} className={styles.fieldMessage} aria-live="polite">
              {showValidation ? validationError : ""}
            </p>
          </div>
          {errorBox}
          <Button
            type="submit"
            disabled={!isMobileValid || sender.isSending}
            aria-busy={sender.isSending}
            className={styles.submitButton}
          >
            {sender.isSending ? (
              <span className={styles.loadingText}>
                <Spinner className={styles.spinner} size="sm" />
                {sendingLabel}
              </span>
            ) : (
              "Send OTP"
            )}
          </Button>
          {offlineNote}
        </form>
      )}

      {step === "otp" && (
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(handleVerifyOtp)}
            className={styles.form}
          >
            <p className={styles.otpInfo}>
              Enter the 4-digit OTP sent to +91 {sentTo}.
              <Button
                type="button"
                variant="link"
                className={styles.changeNumberLink}
                disabled={isBusy}
                onClick={() => {
                  setStep("mobile");
                  setNotice(null);
                  sender.setError(null);
                }}
              >
                Change
              </Button>
            </p>
            <FormItem name="otpCode">
              <FormLabel>OTP Code</FormLabel>
              <FormControl>
                <Input
                  ref={otpInputRef}
                  placeholder="••••"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="go"
                  maxLength={4}
                  disabled={isVerifying}
                  value={otpForm.values.otpCode}
                  onChange={(e) =>
                    otpForm.setValues({ otpCode: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                  className={styles.otpInput}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            {notice && !sender.error && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            {errorBox}
            <div className={styles.resendContainer}>
              <Button
                type="button"
                variant="link"
                onClick={handleResendOtp}
                disabled={sender.cooldownSeconds > 0 || isBusy}
                className={styles.resendButton}
              >
                {sender.isSending ? sendingLabel : "Resend OTP"}
              </Button>
              {sender.cooldownSeconds > 0 && !sender.isSending && (
                <span className={styles.timer}>in {sender.cooldownSeconds}s</span>
              )}
            </div>
            <Button type="submit" disabled={isBusy} className={styles.submitButton}>
              {isVerifying ? (
                <span className={styles.loadingText}>
                  <Spinner className={styles.spinner} size="sm" />
                  Verifying...
                </span>
              ) : (
                "Log In"
              )}
            </Button>
            {offlineNote}
          </form>
        </Form>
      )}

      {/* Mounted for both steps and placed under the button, where a visitor
          Cloudflare flags will look for the checkbox. It mints one token on
          load; a retry or resend asks getToken() for another. The Send OTP
          button never waits on it: the token is awaited only after a press. */}
      <TurnstileWidget ref={turnstileRef} className={sender.challengeVisible ? styles.challengeShown : styles.challenge}
        {...sender.turnstileProps} />
    </div>
  );
};
