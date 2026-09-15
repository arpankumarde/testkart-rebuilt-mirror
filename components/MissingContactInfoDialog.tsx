"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useAuth } from "../helpers/useAuth";
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import { isPlaceholderDisplayName } from "../helpers/isPlaceholderDisplayName";
import { useSendOtpMutation, useVerifyOtpMutation } from "../helpers/useMobileVerification";
import { useSendEmailOtpMutation, useVerifyEmailOtpMutation } from "../helpers/useEmailVerification";
import { useStudentProfileMutations } from "../helpers/useStudentProfileMutations";
import styles from "./MissingContactInfoDialog.module.css";

const RESEND_COOLDOWN_SECONDS = 30;
const DISMISSAL_DAYS = 7;
const DISMISSAL_MS = DISMISSAL_DAYS * 24 * 60 * 60 * 1000;

/** Collected in this order: phone, then email, then name. */
type StepKey = "mobile" | "email" | "name";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const emailOtpSchema = z.object({
  otpCode: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be 6 digits"),
});

const mobileSchema = z.object({
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

const mobileOtpSchema = z.object({
  otpCode: z.string().length(4, "OTP must be 4 digits").regex(/^\d{4}$/, "OTP must be 4 digits"),
});

const nameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be 100 characters or less")
    // Stops the generated placeholder being typed straight back in.
    .refine((value) => !isPlaceholderDisplayName(value), {
      message: "Please enter your real full name",
    }),
});

export const MissingContactInfoDialog: React.FC = () => {
  const { authState } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<"input" | "otp">("input");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [skippedSteps, setSkippedSteps] = useState<StepKey[]>([]);

  const otpInputRef = useRef<HTMLInputElement>(null);
  // Frozen when the dialog opens so the "Step 1 of 3" counter does not shrink
  // as each step is completed and drops out of the pending list.
  const totalStepsRef = useRef<number | null>(null);

  const sendEmailOtpMutation = useSendEmailOtpMutation();
  const verifyEmailOtpMutation = useVerifyEmailOtpMutation();
  const sendMobileOtpMutation = useSendOtpMutation();
  const verifyMobileOtpMutation = useVerifyOtpMutation();
  const { useUpdateStudentProfileMutation } = useStudentProfileMutations();
  const updateProfileMutation = useUpdateStudentProfileMutation();

  const emailForm = useForm({ defaultValues: { email: "" }, schema: emailSchema });
  const emailOtpForm = useForm({ defaultValues: { otpCode: "" }, schema: emailOtpSchema });
  const mobileForm = useForm({ defaultValues: { mobileNumber: "" }, schema: mobileSchema });
  const mobileOtpForm = useForm({ defaultValues: { otpCode: "" }, schema: mobileOtpSchema });
  // Deliberately empty, never seeded from the user: the whole point is to
  // replace a generated name, so offering it back as a default defeats the ask.
  const nameForm = useForm({ defaultValues: { displayName: "" }, schema: nameSchema });

  const userId = authState.type === "authenticated" ? authState.user.id : null;
  const userEmail = authState.type === "authenticated" ? authState.user.email : null;
  const userMobileNumber =
    authState.type === "authenticated" ? authState.user.mobileNumber : null;
  const userDisplayName =
    authState.type === "authenticated" ? authState.user.displayName : null;
  // The name step writes through /_api/student/profile/update, which rejects
  // teachers - and this dialog is mounted by the teacher shell too.
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";

  /*
   * Steps are derived from the session, not held in state. Each mutation
   * refreshes AUTH_QUERY_KEY, so a completed step drops out of this list on its
   * own and the next one becomes current - no manual advance to keep in sync.
   */
  const pendingSteps = useMemo(() => {
    const steps: StepKey[] = [];
    if (!userMobileNumber) steps.push("mobile");
    if (!userEmail) steps.push("email");
    if (isStudent && isPlaceholderDisplayName(userDisplayName)) steps.push("name");
    return steps;
  }, [userMobileNumber, userEmail, userDisplayName, isStudent]);

  const remainingSteps = pendingSteps.filter((step) => !skippedSteps.includes(step));
  const currentStep: StepKey | null = remainingSteps[0] ?? null;

  const totalSteps = totalStepsRef.current ?? pendingSteps.length;
  const stepNumber = Math.min(
    totalSteps,
    Math.max(1, totalSteps - remainingSteps.length + 1)
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (phase === "otp") otpInputRef.current?.focus();
  }, [phase]);

  // Moving to a new step always starts at its first phase with a clean slate.
  useEffect(() => {
    setPhase("input");
    setError(null);
    setInputValue("");
  }, [currentStep]);

  // Everything collected (or skipped): close.
  useEffect(() => {
    if (isOpen && currentStep === null) setIsOpen(false);
  }, [isOpen, currentStep]);

  /*
   * Depends on the primitives it reads, NOT on authState. AuthProvider rebuilds
   * authState on every render, so an [authState] dependency re-ran this effect
   * each time and its cleanup cleared the timer - any re-render inside the 1.5s
   * window cancelled the open and the dialog silently never appeared.
   */
  useEffect(() => {
    if (userId === null) return;

    const hasMissing =
      !userMobileNumber ||
      !userEmail ||
      (isStudent && isPlaceholderDisplayName(userDisplayName));

    if (!hasMissing) {
      setIsOpen(false);
      return;
    }

    const dismissalKey = `testkart_contact_info_dismissed_${userId}`;
    const lastDismissedStr = localStorage.getItem(dismissalKey);

    if (lastDismissedStr) {
      const lastDismissed = parseInt(lastDismissedStr, 10);
      if (!isNaN(lastDismissed) && Date.now() - lastDismissed < DISMISSAL_MS) {
        // Dismissed recently, do not show
        return;
      }
    }

    // Delay opening to not interrupt the initial page load
    const timer = setTimeout(() => {
      const steps: StepKey[] = [];
      if (!userMobileNumber) steps.push("mobile");
      if (!userEmail) steps.push("email");
      if (isStudent && isPlaceholderDisplayName(userDisplayName)) steps.push("name");
      totalStepsRef.current = steps.length;
      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [userId, userEmail, userMobileNumber, userDisplayName, isStudent]);

  if (authState.type !== "authenticated" || currentStep === null) {
    return null;
  }

  const handleDismiss = () => {
    const dismissalKey = `testkart_contact_info_dismissed_${authState.user.id}`;
    localStorage.setItem(dismissalKey, Date.now().toString());
    setIsOpen(false);
    totalStepsRef.current = null;
    // Reset state for next time
    setTimeout(() => {
      setPhase("input");
      setError(null);
      setInputValue("");
      setSkippedSteps([]);
      emailForm.setValues({ email: "" });
      mobileForm.setValues({ mobileNumber: "" });
      emailOtpForm.setValues({ otpCode: "" });
      mobileOtpForm.setValues({ otpCode: "" });
      nameForm.setValues({ displayName: "" });
    }, 300);
  };

  const handleSkipStep = () => {
    setError(null);
    setSkippedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
  };

  const startResendTimer = () => setResendTimer(RESEND_COOLDOWN_SECONDS);

  const handleSendEmailOtp = (data: { email: string }) => {
    setError(null);
    sendEmailOtpMutation.mutate(data, {
      onSuccess: () => {
        setInputValue(data.email);
        setPhase("otp");
        startResendTimer();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleVerifyEmailOtp = (data: { otpCode: string }) => {
    setError(null);
    verifyEmailOtpMutation.mutate(
      { email: inputValue, otpCode: data.otpCode },
      {
        // No close here: the session refresh drops this step and the next one
        // takes over, or the "nothing pending" effect closes the dialog.
        onSuccess: () => emailOtpForm.setValues({ otpCode: "" }),
        onError: (err) => {
          setError(err.message);
          emailOtpForm.setValues({ otpCode: "" });
        },
      }
    );
  };

  const handleSendMobileOtp = (data: { mobileNumber: string }) => {
    setError(null);
    sendMobileOtpMutation.mutate(data, {
      onSuccess: () => {
        setInputValue(data.mobileNumber);
        setPhase("otp");
        startResendTimer();
      },
      onError: (err) => setError(err.message),
    });
  };

  const handleVerifyMobileOtp = (data: { otpCode: string }) => {
    setError(null);
    verifyMobileOtpMutation.mutate(
      { mobileNumber: inputValue, otpCode: data.otpCode },
      {
        onSuccess: () => mobileOtpForm.setValues({ otpCode: "" }),
        onError: (err) => {
          setError(err.message);
          mobileOtpForm.setValues({ otpCode: "" });
        },
      }
    );
  };

  const handleSaveName = (data: { displayName: string }) => {
    setError(null);
    updateProfileMutation.mutate(
      { displayName: data.displayName.trim() },
      {
        onSuccess: () => nameForm.setValues({ displayName: "" }),
        onError: (err) => setError(err.message),
      }
    );
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    if (currentStep === "email") {
      handleSendEmailOtp({ email: inputValue });
    } else if (currentStep === "mobile") {
      handleSendMobileOtp({ mobileNumber: inputValue });
    }
  };

  const handleChangeInput = () => {
    setPhase("input");
    setError(null);
    if (currentStep === "email") {
      emailOtpForm.setValues({ otpCode: "" });
    } else {
      mobileOtpForm.setValues({ otpCode: "" });
    }
  };

  const isSending = sendEmailOtpMutation.isPending || sendMobileOtpMutation.isPending;
  const isVerifying = verifyEmailOtpMutation.isPending || verifyMobileOtpMutation.isPending;
  const isLoading = isSending || isVerifying || updateProfileMutation.isPending;

  const hasLaterStep = remainingSteps.length > 1;

  const stepCopy: Record<StepKey, { title: string; description: string }> = {
    mobile: {
      title: "Add your mobile number",
      description: "For quick access and better account security.",
    },
    email: {
      title: "Add your email address",
      description: "So we can send you important updates about your tests and account.",
    },
    name: {
      title: "What should we call you?",
      description: "Your account is still using an auto-generated name. Enter your full name.",
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent
        className={styles.dialogContent}
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          {totalSteps > 1 && (
            <span className={styles.stepIndicator}>
              Step {stepNumber} of {totalSteps}
            </span>
          )}
          <DialogTitle>{stepCopy[currentStep].title}</DialogTitle>
          <DialogDescription>{stepCopy[currentStep].description}</DialogDescription>
        </DialogHeader>

        <div className={styles.container}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          {phase === "input" && currentStep === "email" && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleSendEmailOtp)} className={styles.form}>
                <FormItem name="email">
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your email"
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                      value={emailForm.values.email}
                      onChange={(e) => emailForm.setValues({ email: e.target.value })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <Button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? (
                    <span className={styles.loadingText}>
                      <Spinner className={styles.spinner} size="sm" />
                      Sending Code...
                    </span>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {phase === "input" && currentStep === "mobile" && (
            <Form {...mobileForm}>
              <form onSubmit={mobileForm.handleSubmit(handleSendMobileOtp)} className={styles.form}>
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
                        mobileForm.setValues({ mobileNumber: sanitizeMobileInput(e.target.value) })
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <Button type="submit" disabled={isLoading} className={styles.submitButton}>
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

          {currentStep === "name" && (
            <Form {...nameForm}>
              <form onSubmit={nameForm.handleSubmit(handleSaveName)} className={styles.form}>
                <FormItem name="displayName">
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your full name"
                      type="text"
                      autoComplete="off"
                      autoFocus
                      disabled={isLoading}
                      value={nameForm.values.displayName}
                      onChange={(e) => nameForm.setValues({ displayName: e.target.value })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <Button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? (
                    <span className={styles.loadingText}>
                      <Spinner className={styles.spinner} size="sm" />
                      Saving...
                    </span>
                  ) : (
                    "Save Name"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {phase === "otp" && currentStep === "email" && (
            <Form {...emailOtpForm}>
              <form onSubmit={emailOtpForm.handleSubmit(handleVerifyEmailOtp)} className={styles.form}>
                <p className={styles.otpInfo}>
                  Enter the 6-digit code sent to {inputValue}.
                  <Button variant="link" className={styles.changeLink} onClick={handleChangeInput}>
                    Change
                  </Button>
                </p>
                <FormItem name="otpCode">
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input
                      ref={otpInputRef}
                      placeholder="••••••"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      disabled={isLoading}
                      value={emailOtpForm.values.otpCode}
                      onChange={(e) => emailOtpForm.setValues({ otpCode: e.target.value })}
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
                    Resend Code
                  </Button>
                  {resendTimer > 0 && <span className={styles.timer}>in {resendTimer}s</span>}
                </div>
                <Button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? (
                    <span className={styles.loadingText}>
                      <Spinner className={styles.spinner} size="sm" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify Email"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {phase === "otp" && currentStep === "mobile" && (
            <Form {...mobileOtpForm}>
              <form onSubmit={mobileOtpForm.handleSubmit(handleVerifyMobileOtp)} className={styles.form}>
                <p className={styles.otpInfo}>
                  Enter the 4-digit OTP sent to +91 {inputValue}.
                  <Button variant="link" className={styles.changeLink} onClick={handleChangeInput}>
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
                      value={mobileOtpForm.values.otpCode}
                      onChange={(e) => mobileOtpForm.setValues({ otpCode: e.target.value })}
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
                  {resendTimer > 0 && <span className={styles.timer}>in {resendTimer}s</span>}
                </div>
                <Button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? (
                    <span className={styles.loadingText}>
                      <Spinner className={styles.spinner} size="sm" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify Mobile"
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className={styles.skipContainer}>
            {hasLaterStep && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipStep}
                disabled={isLoading}
                className={styles.skipButton}
              >
                Skip this step
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isLoading}
              className={styles.skipButton}
            >
              Skip for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
