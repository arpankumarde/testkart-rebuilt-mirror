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
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import {
  useSendMobileSignupOtpMutation,
  useVerifyAndRegisterMutation,
} from "../helpers/useMobileSignup";
import styles from "./MobileOTPSignupForm.module.css";

const RESEND_COOLDOWN_SECONDS = 30;

const mobileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

const otpSchema = z.object({
  otpCode: z
    .string()
    .length(4, "OTP must be 4 digits")
    .regex(/^\d{4}$/, "OTP must be 4 digits"),
});

type MobileFormData = z.infer<typeof mobileSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

interface MobileOTPSignupFormProps {
  className?: string;
  redirectPath?: string;
  role: "student" | "teacher";
}

export const MobileOTPSignupForm: React.FC<MobileOTPSignupFormProps> = ({
  className,
  redirectPath,
  role,
}) => {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [error, setError] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const otpInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const sendOtpMutation = useSendMobileSignupOtpMutation();
  const verifyAndRegisterMutation = useVerifyAndRegisterMutation();

  const mobileForm = useForm({
    defaultValues: { displayName: "", mobileNumber: "" },
    schema: mobileSchema,
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

  const handleSendOtp = async (data: MobileFormData) => {
    setError(null);
    sendOtpMutation.mutate(
      { mobileNumber: data.mobileNumber, role, turnstileToken: turnstileToken ?? undefined },
      {
        onSuccess: () => {
          setMobileNumber(data.mobileNumber);
          setDisplayName(data.displayName.trim());
          setStep("otp");
          startResendTimer();
        },
        onError: (err) => setError(err.message),
        onSettled: () => {
          // Turnstile tokens are single-use — always get a fresh one for
          // the next attempt (including resends).
          setTurnstileToken(null);
          turnstileRef.current?.reset();
        },
      }
    );
  };

  const handleVerifyAndRegister = async (data: OtpFormData) => {
    setError(null);
    verifyAndRegisterMutation.mutate(
      { mobileNumber, otpCode: data.otpCode, role, displayName },
      {
        onSuccess: (result) => {
          if ("user" in result) {
            onLogin(result.user);
            trackGTMEvent({
              event: role === 'student' ? 'student_signup' : 'teacher_signup',
              user_type: role,
              method: 'mobile'
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
    // Re-send using the stored mobile number and display name
    sendOtpMutation.mutate(
      { mobileNumber, role, turnstileToken: turnstileToken ?? undefined },
      {
        onSuccess: () => {
          startResendTimer();
          setError(null);
        },
        onError: (err) => setError(err.message),
        onSettled: () => {
          setTurnstileToken(null);
          turnstileRef.current?.reset();
        },
      }
    );
  };

  const isLoading = sendOtpMutation.isPending || verifyAndRegisterMutation.isPending;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* Always mounted (both steps) so a fresh token is ready for resends
          too — tokens are single-use and reset after every send attempt. */}
      <TurnstileWidget
        ref={turnstileRef}
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken(null)}
      />

      {step === "mobile" && (
        <Form {...mobileForm}>
          <form onSubmit={mobileForm.handleSubmit(handleSendOtp)} className={styles.form}>
            <FormItem name="displayName">
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  type="text"
                  autoComplete="name"
                  disabled={isLoading}
                  value={mobileForm.values.displayName}
                  onChange={(e) =>
                    mobileForm.setValues((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="mobileNumber">
              <FormLabel>Mobile Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your 10-digit mobile number"
                  type="tel"
                  autoComplete="tel"
                  disabled={isLoading}
                  value={mobileForm.values.mobileNumber}
                  onChange={(e) =>
                    mobileForm.setValues((prev) => ({ ...prev, mobileNumber: sanitizeMobileInput(e.target.value) }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <Button type="submit" disabled={isLoading || !turnstileToken} className={styles.submitButton}>
              {isLoading ? <Spinner size="sm" /> : "Send OTP"}
            </Button>
          </form>
        </Form>
      )}

      {step === "otp" && (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(handleVerifyAndRegister)} className={styles.form}>
            <p className={styles.otpInfo}>
              Enter the 4-digit OTP sent to +91 {mobileNumber}.
              <Button
                variant="link"
                className={styles.changeNumberLink}
                onClick={() => { setStep("mobile"); setError(null); }}
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
                  maxLength={4}
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