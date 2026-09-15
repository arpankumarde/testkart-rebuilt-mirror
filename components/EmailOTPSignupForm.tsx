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
import { trackGTMEvent } from "../helpers/trackGTMEvent";
import {
  useSendEmailSignupOtpMutation,
  useVerifyEmailSignupAndRegisterMutation,
} from "../helpers/useEmailSignup";
import styles from "./EmailOTPSignupForm.module.css";

const RESEND_COOLDOWN_SECONDS = 30;

const emailSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
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

interface EmailOTPSignupFormProps {
  className?: string;
  redirectPath?: string;
  role: "student" | "teacher";
}

export const EmailOTPSignupForm: React.FC<EmailOTPSignupFormProps> = ({
  className,
  redirectPath,
  role,
}) => {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const otpInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const sendOtpMutation = useSendEmailSignupOtpMutation();
  const verifyAndRegisterMutation = useVerifyEmailSignupAndRegisterMutation();

  const emailForm = useForm({
    defaultValues: { displayName: "", email: "" },
    schema: emailSchema,
  });
  const otpForm = useForm({
    defaultValues: { otpCode: "" },
    schema: otpSchema,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const startResendTimer = () => setResendTimer(RESEND_COOLDOWN_SECONDS);

  // Turnstile tokens are single-use, so every send attempt - first send or
  // resend, success or failure - has to mint a fresh one for the next try.
  const consumeTurnstileToken = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const handleSendOtp = async (data: EmailFormData) => {
    setError(null);
    sendOtpMutation.mutate(
      { email: data.email, role, turnstileToken: turnstileToken ?? undefined },
      {
        onSuccess: () => {
          setEmail(data.email);
          setDisplayName(data.displayName.trim());
          setStep("otp");
          startResendTimer();
        },
        onError: (err) => setError(err.message),
        onSettled: consumeTurnstileToken,
      }
    );
  };

  const handleVerifyAndRegister = async (data: OtpFormData) => {
    setError(null);
    verifyAndRegisterMutation.mutate(
      { email, otpCode: data.otpCode, role, displayName },
      {
        onSuccess: (result) => {
          if ("user" in result) {
            onLogin(result.user);
            trackGTMEvent({
              event: role === 'student' ? 'student_signup' : 'teacher_signup',
              user_type: role,
              method: 'email'
            });
            // Determine redirect path based on role
            const finalRedirectPath = redirectPath ||
              (role === "student"
                ? "/student/dashboard"
                : "/teacher/onboarding");
            setTimeout(() => navigate(finalRedirectPath), 200);
          }
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
    // Re-send using the stored email address
    sendOtpMutation.mutate(
      { email, role, turnstileToken: turnstileToken ?? undefined },
      {
        onSuccess: () => {
          startResendTimer();
          setError(null);
        },
        onError: (err) => setError(err.message),
        onSettled: consumeTurnstileToken,
      }
    );
  };

  const isLoading = sendOtpMutation.isPending || verifyAndRegisterMutation.isPending;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* Mounted for both steps, not just the email step: the resend button
          needs a token too, and tokens are reset after every send attempt. */}
      <TurnstileWidget
        ref={turnstileRef}
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken(null)}
      />

      {step === "email" && (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(handleSendOtp)} className={styles.form}>
            <FormItem name="displayName">
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  type="text"
                  autoComplete="name"
                  disabled={isLoading}
                  value={emailForm.values.displayName}
                  onChange={(e) =>
                    emailForm.setValues((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
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
                    emailForm.setValues((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <Button
              type="submit"
              disabled={isLoading || !turnstileToken}
              className={styles.submitButton}
            >
              {isLoading ? <Spinner size="sm" /> : "Send OTP"}
            </Button>
          </form>
        </Form>
      )}

      {step === "otp" && (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(handleVerifyAndRegister)} className={styles.form}>
            <p className={styles.otpInfo}>
              Enter the 6-digit OTP sent to {email}.
              <Button
                variant="link"
                className={styles.changeNumberLink}
                onClick={() => { setStep("email"); setError(null); }}
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
                  onChange={(e) => otpForm.setValues({ otpCode: e.target.value })}
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
                disabled={resendTimer > 0 || isLoading || !turnstileToken}
                className={styles.resendButton}
              >
                Resend OTP
              </Button>
              {resendTimer > 0 && <span className={styles.timer}>in {resendTimer}s</span>}
            </div>
            <Button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? <Spinner size="sm" /> : "Verify & Create Account"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
};
