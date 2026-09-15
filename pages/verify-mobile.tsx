import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { Loader2, Smartphone, KeyRound } from "lucide-react";

import { useAuth } from "../helpers/useAuth";
import { getRoleHomePath } from "../helpers/roleHomePath";
import {
  useSendOtpMutation,
  useVerifyOtpMutation,
} from "../helpers/useMobileVerification";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import styles from "./verify-mobile.module.css";

const mobileSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number."),
});

const otpSchema = z.object({
  otpCode: z.string().length(4, "OTP must be 4 digits."),
});

type VerificationStep = "enter-mobile" | "enter-otp";

export default function VerifyMobilePage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [step, setStep] = useState<VerificationStep>("enter-mobile");
  const [mobileNumber, setMobileNumber] = useState("");
  const [countdown, setCountdown] = useState(60);

  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();

  const mobileForm = useForm({
    schema: mobileSchema,
    defaultValues: { mobileNumber: "" },
  });

  const otpForm = useForm({
    schema: otpSchema,
    defaultValues: { otpCode: "" },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "enter-otp" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleSendOtp = (values: z.infer<typeof mobileSchema>) => {
    sendOtpMutation.mutate(values, {
      onSuccess: () => {
        setMobileNumber(values.mobileNumber);
        setStep("enter-otp");
        setCountdown(60);
      },
    });
  };

  const handleVerifyOtp = (values: z.infer<typeof otpSchema>) => {
    if (!mobileNumber) {
      toast.error("Mobile number not found. Please start over.");
      setStep("enter-mobile");
      return;
    }
    verifyOtpMutation.mutate(
      { ...values, mobileNumber },
      {
        onSuccess: () => {
          navigate(
            authState.type === "authenticated"
              ? getRoleHomePath(authState.user)
              : "/student/dashboard"
          );
        },
      }
    );
  };

  const handleResendOtp = () => {
    if (countdown > 0) return;
    sendOtpMutation.mutate({ mobileNumber }, {
      onSuccess: () => {
        setCountdown(60);
      }
    });
  };

  const handleSkip = () => {
    navigate(
      authState.type === "authenticated"
        ? getRoleHomePath(authState.user)
        : "/student/dashboard"
    );
  };

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";

  return (
    <>
      <Helmet>
        <title>Verify Mobile Number | Testkart</title>
        <meta
          name="description"
          content="Verify your mobile number to secure your Testkart account."
        />
      </Helmet>
      <div className={styles.container}>
        <div className={styles.card}>
          {step === "enter-mobile" ? (
            <>
              <div className={styles.header}>
                <Smartphone className={styles.icon} />
                <h1 className={styles.title}>Verify Your Mobile Number</h1>
                <p className={styles.subtitle}>
                  {isTeacher
                    ? "Please verify your mobile number to continue."
                    : "Secure your account by verifying your mobile number."}
                </p>
              </div>
              <Form {...mobileForm}>
                <form onSubmit={mobileForm.handleSubmit(handleSendOtp)}>
                  <FormItem name="mobileNumber">
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <div className={styles.inputGroup}>
                        <span className={styles.countryCode}>+91</span>
                        <Input
                          placeholder="9876543210"
                          maxLength={10}
                          value={mobileForm.values.mobileNumber}
                          onChange={(e) =>
                            mobileForm.setValues({ mobileNumber: e.target.value })
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <Button
                    type="submit"
                    className={styles.submitButton}
                    disabled={sendOtpMutation.isPending}
                  >
                    {sendOtpMutation.isPending && (
                      <Loader2 className={styles.spinner} />
                    )}
                    Send OTP
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <div className={styles.header}>
                <KeyRound className={styles.icon} />
                <h1 className={styles.title}>Enter OTP</h1>
                <p className={styles.subtitle}>
                  An OTP has been sent to{" "}
                  <span className={styles.mobileHighlight}>
                    +91-{mobileNumber}
                  </span>
                  .
                </p>
              </div>
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)}>
                  <FormItem name="otpCode">
                    <FormLabel>One-Time Password</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 4-digit OTP"
                        maxLength={4}
                        value={otpForm.values.otpCode}
                        onChange={(e) =>
                          otpForm.setValues({ otpCode: e.target.value })
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <div className={styles.resendContainer}>
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || sendOtpMutation.isPending}
                    >
                      {sendOtpMutation.isPending ? 'Sending...' : 'Resend OTP'}
                    </Button>
                    {countdown > 0 && (
                      <span className={styles.countdown}>in {countdown}s</span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className={styles.submitButton}
                    disabled={verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending && (
                      <Loader2 className={styles.spinner} />
                    )}
                    Verify
                  </Button>
                </form>
              </Form>
            </>
          )}
          {!isTeacher && (
            <Button
              variant="ghost"
              className={styles.skipButton}
              onClick={handleSkip}
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </>
  );
}