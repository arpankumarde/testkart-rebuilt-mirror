import React, { useState, useRef, useEffect } from "react";
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
import {
  useSendEmailLoginOtpMutation,
  useVerifyEmailLoginOtpMutation,
} from "../helpers/useEmailLogin";
import styles from "./EmailOTPLoginForm.module.css";

const RESEND_COOLDOWN_SECONDS = 30;

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be 6 digits"),
});

type EmailFormData = z.infer<typeof emailSchema>;
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
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [awaitingToken, setAwaitingToken] = useState(false);

  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const otpInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const sendOtpMutation = useSendEmailLoginOtpMutation();
  const verifyOtpMutation = useVerifyEmailLoginOtpMutation();

  const emailForm = useForm({
    defaultValues: { email: "" },
    schema: emailSchema,
  });

  const otpForm = useForm({
    defaultValues: { otpCode: "" },
    schema: otpSchema,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (step === "otp") {
      otpInputRef.current?.focus();
    }
  }, [step]);

  const startResendTimer = () => {
    setResendTimer(RESEND_COOLDOWN_SECONDS);
  };

  const handleSendOtp = async (data: EmailFormData) => {
    setError(null);
    setAwaitingToken(true);
    // Single-use: the first send spends the token minted on load, and only a
    // later send (a retry or resend) runs a new check.
    const turnstileToken = await turnstileRef.current?.getToken();
    sendOtpMutation.mutate(
      { ...data, turnstileToken: turnstileToken ?? undefined },
      {
        onSuccess: () => {
          setEmail(data.email);
          setStep("otp");
          startResendTimer();
        },
        onError: (err) => {
          setError(err.message);
        },
        onSettled: () => setAwaitingToken(false),
      }
    );
  };

  const handleVerifyOtp = async (data: OtpFormData) => {
    setError(null);
    verifyOtpMutation.mutate(
      { email, otpCode: data.otpCode, role },
      {
        onSuccess: (result) => {
          onLogin(result.user);
          setTimeout(() => navigate(redirectPath), 200);
        },
        onError: (err) => {
          setError(err.message);
          otpForm.setValues({ otpCode: "" });
        },
      }
    );
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    handleSendOtp({ email });
  };

  const isLoading =
    awaitingToken || sendOtpMutation.isPending || verifyOtpMutation.isPending;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* Mounted for both steps. It mints one token on load for the first
          send; a retry or resend asks getToken() for another, so nobody is
          challenged twice for the same send. */}
      <TurnstileWidget ref={turnstileRef} onVerify={() => setTurnstileReady(true)} />

      {step === "email" && (
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(handleSendOtp)}
            className={styles.form}
          >
            <FormItem name="email">
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your email address"
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  value={emailForm.values.email}
                  onChange={(e) =>
                    emailForm.setValues({ email: e.target.value })
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <Button
              type="submit"
              disabled={isLoading || !turnstileReady}
              className={styles.submitButton}
            >
              {isLoading ? (
                <span className={styles.loadingText}>
                  <Spinner className={styles.spinner} size="sm" />
                  Sending OTP...
                </span>
              ) : (
                "Send OTP"
              )}
            </Button>
          </form>
        </Form>
      )}

      {step === "otp" && (
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(handleVerifyOtp)}
            className={styles.form}
          >
            <p className={styles.otpInfo}>
              Enter the 6-digit OTP sent to {email}.
              <Button
                variant="link"
                className={styles.changeNumberLink}
                onClick={() => {
                  setStep("email");
                  setError(null);
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
                  maxLength={6}
                  disabled={isLoading}
                  value={otpForm.values.otpCode}
                  onChange={(e) =>
                    otpForm.setValues({ otpCode: e.target.value })
                  }
                  className={styles.otpInput}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <div className={styles.resendContainer}>
              <Button
                type="button"
                variant="link"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || isLoading}
                className={styles.resendButton}
              >
                Resend OTP
              </Button>
              {resendTimer > 0 && (
                <span className={styles.timer}>in {resendTimer}s</span>
              )}
            </div>
            <Button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? (
                <span className={styles.loadingText}>
                  <Spinner className={styles.spinner} size="sm" />
                  Verifying...
                </span>
              ) : (
                "Log In"
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
};
