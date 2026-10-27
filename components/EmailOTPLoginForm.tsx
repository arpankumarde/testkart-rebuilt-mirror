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
import { authErrorMessage } from "../helpers/authRequest";
import { useOtpSender } from "../helpers/useOtpSender";
import {
  useSendEmailLoginOtpMutation,
  useVerifyEmailLoginOtpMutation,
} from "../helpers/useEmailLogin";
import styles from "./EmailOTPLoginForm.module.css";

const emailFormat = z.string().email();

/** Synchronous, so the button state always matches what is in the field. */
function emailValidationError(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter your email address";
  return emailFormat.safeParse(value).success ? null : "Please enter a valid email address";
}

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be 6 digits"),
});

type OtpFormData = z.infer<typeof otpSchema>;

interface EmailOTPLoginFormProps {
  className?: string;
  redirectPath?: string;
  role?: "user" | "teacher";
}

export const EmailOTPLoginForm: React.FC<EmailOTPLoginFormProps> = ({
  className,
  redirectPath = "/",
  role = "user",
}) => {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [emailInput, setEmailInput] = useState("");
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
  const sendOtpMutation = useSendEmailLoginOtpMutation();
  const verifyOtpMutation = useVerifyEmailLoginOtpMutation();

  const otpForm = useForm({
    defaultValues: { otpCode: "" },
    schema: otpSchema,
  });

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const validationError = emailValidationError(emailInput);
  const isEmailValid = validationError === null;
  const showValidation = touched && emailInput.trim() !== "" && !isEmailValid;
  const isVerifying = verifyOtpMutation.isPending;
  const isBusy = sender.isSending || isVerifying;

  const sendTo = (email: string) =>
    sender.send((turnstileToken) => sendOtpMutation.mutateAsync({ email, turnstileToken }));

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isEmailValid || isBusy) return;
    const email = emailInput.trim().toLowerCase();
    setNotice(null);
    if (await sendTo(email)) {
      setSentTo(email);
      otpForm.setValues({ otpCode: "" });
      setStep("otp");
    }
  };

  const handleResendOtp = async () => {
    if (sender.cooldownSeconds > 0 || isBusy) return;
    setNotice(null);
    if (await sendTo(sentTo)) {
      otpForm.setValues({ otpCode: "" });
      setNotice(`A new OTP has been sent to ${sentTo}.`);
      otpInputRef.current?.focus();
    }
  };

  const handleVerifyOtp = (data: OtpFormData) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    sender.setError(null);
    setNotice(null);
    verifyOtpMutation.mutate(
      { email: sentTo, otpCode: data.otpCode, role },
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
      {step === "email" && (
        <form onSubmit={handleSendOtp} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor={fieldId} className={styles.label}>
              Email Address
            </label>
            <Input
              id={fieldId}
              placeholder="Enter your email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              disabled={sender.isSending}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
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
            disabled={!isEmailValid || sender.isSending}
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
              Enter the 6-digit OTP sent to {sentTo}.
              <Button
                type="button"
                variant="link"
                className={styles.changeNumberLink}
                disabled={isBusy}
                onClick={() => {
                  setStep("email");
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
                  placeholder="••••••"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="go"
                  maxLength={6}
                  disabled={isVerifying}
                  value={otpForm.values.otpCode}
                  onChange={(e) =>
                    otpForm.setValues({ otpCode: e.target.value.replace(/\D/g, "").slice(0, 6) })
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
