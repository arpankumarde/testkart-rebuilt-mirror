import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { Spinner } from "./Spinner";
import {
  useSponsorCheck,
  useSponsorEnroll,
} from "../helpers/useTeacherSponsoredEnrollments";
import { useAuth } from "../helpers/useAuth";
import { useTeacherTestsQuery } from "../helpers/useTeacherTestsQuery";
import { useTeacherCoursesQuery } from "../helpers/useTeacherCoursesQuery";
import { useTeacherProductsQuery } from "../helpers/useTeacherProductsQuery";
import { useTeacherBundlesQuery } from "../helpers/useTeacherBundlesQuery";
import { parseSponsorIdentifier, type SponsorAccountCandidate } from "../helpers/sponsorStudentAccount";
import { CheckCircle2, XCircle, Info, ExternalLink, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import {
  SponsorPaymentMethodSelector,
  PaymentMethod,
} from "./SponsorPaymentMethodSelector";
import { SponsorCostBreakdown } from "./SponsorCostBreakdown";
import { SponsorSuccessView } from "./SponsorSuccessView";
import { postPaymentPayuRedirect } from "../endpoints/payment/payu/redirect_POST.schema";
import styles from "./SponsorStudentDialog.module.css";

interface SponsorStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mockTestId?: number; // Optional pre-selected test
}

export const SponsorStudentDialog: React.FC<SponsorStudentDialogProps> = ({
  open,
  onOpenChange,
  mockTestId: initialMockTestId,
}) => {
  const [contentType, setContentType] = useState<'test' | 'course' | 'product' | 'bundle'>('test');
  const [identifier, setIdentifier] = useState("");
  const [selectedContentId, setSelectedContentId] = useState<string>(
    initialMockTestId ? initialMockTestId.toString() : ""
  );
  // 0 means no check requested for the current inputs; each Check press bumps it.
  const [checkRequestId, setCheckRequestId] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>(undefined);
  // Kept apart from the query so the account list stays put while a pick is re-checked.
  const [candidates, setCandidates] = useState<SponsorAccountCandidate[] | null>(null);
  const [identifierTouched, setIdentifierTouched] = useState(false);

  // New user creation state
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [sendCredentials, setSendCredentials] = useState(true);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<{
    phone?: string;
    email?: string;
    temporaryPassword?: string;
    credentialsSent?: boolean;
  } | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("balance");
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Queries
  const { data: teacherTests, isLoading: isLoadingTests } = useTeacherTestsQuery();
  const { data: coursesData, isLoading: isLoadingCourses } = useTeacherCoursesQuery();
  const { data: productsData, isLoading: isLoadingProducts } = useTeacherProductsQuery({ page: 1, limit: 100 });
  const { data: bundlesData, isLoading: isLoadingBundles } = useTeacherBundlesQuery({ page: "1", limit: "100" });
  const { authState } = useAuth();
  const isManager =
    authState.type === "authenticated" && authState.user.teacherRole === "manager";

  // Filter content
  const paidPublishedTests = teacherTests?.filter(
    (t) => !t.isFree && Number(t.price) > 0 && t.isPublished
  ) || [];

  const paidPublishedCourses = coursesData?.filter(
    (c) => Number(c.price) > 0 && c.status === "published"
  ) || [];

  const paidPublishedProducts = productsData?.products?.filter(
    (p) => Number(p.price) > 0 && p.isPublished
  ) || [];

  const paidPublishedBundles = bundlesData?.bundles?.filter(
    (b) => Number(b.price) > 0 && b.isPublished
  ) || [];

  let currentOptions: { id: number; title: string; price: number }[] = [];
  let isLoadingContent = false;
  let contentLabel = "Select Content";

  if (contentType === 'test') {
    currentOptions = paidPublishedTests;
    isLoadingContent = isLoadingTests;
    contentLabel = "Select Test Series";
  } else if (contentType === 'course') {
    currentOptions = paidPublishedCourses;
    isLoadingContent = isLoadingCourses;
    contentLabel = "Select Course";
  } else if (contentType === 'product') {
    currentOptions = paidPublishedProducts;
    isLoadingContent = isLoadingProducts;
    contentLabel = "Select Study Notes";
  } else if (contentType === 'bundle') {
    currentOptions = paidPublishedBundles;
    isLoadingContent = isLoadingBundles;
    contentLabel = "Select Bundle";
  }

  // Derived state for check query
  const contentIdToUse = selectedContentId ? parseInt(selectedContentId) : null;

  // Same parsing as the server: a valid email, or a 10-digit number (+91 allowed).
  const parsedIdentifier = parseSponsorIdentifier(identifier);
  const isIdentifierValid = parsedIdentifier.ok;
  const identifierHint =
    identifierTouched && identifier.trim().length > 0 && !parsedIdentifier.ok ? parsedIdentifier.message : null;

  const isEmailIdentifier = identifier.includes("@");

  const shouldCheck =
    checkRequestId > 0 && isIdentifierValid && contentIdToUse !== null;

  const {
    data: checkData,
    isFetching: isChecking,
    error: checkError,
    isError: isCheckError,
    refetch: retryCheck,
  } = useSponsorCheck(identifier, contentIdToUse, contentType, shouldCheck, checkRequestId, selectedStudentId);

  useEffect(() => {
    if (checkData?.user.candidates) {
      setCandidates(checkData.user.candidates);
    } else if (checkData) {
      setCandidates(null);
    }
  }, [checkData]);

  // Mutation
  const { mutate: enrollStudent, isPending: isEnrolling } = useSponsorEnroll();

  // Check for payment callback params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("sponsored");
    if (status === "success") {
      toast.success("Payment successful! Student has been enrolled.");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    } else if (status === "failed") {
      toast.error("Payment failed or was cancelled.");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setIdentifier("");
      setCheckRequestId(0);
      setSelectedStudentId(undefined);
      setCandidates(null);
      setIdentifierTouched(false);
      setStudentName("");
      setStudentEmail("");
      setStudentPhone("");
      setSendCredentials(true);
      setEnrollmentSuccess(null);
      setIsRedirecting(false);
      setPaymentMethod("balance");

      if (initialMockTestId) {
        setContentType('test');
        setSelectedContentId(initialMockTestId.toString());
      } else {
        setContentType('test');
        setSelectedContentId("");
      }
    }
  }, [open, initialMockTestId]);

  // Any input change drops the previous result, the account pick and the new-student fields.
  useEffect(() => {
    setCheckRequestId(0);
    setSelectedStudentId(undefined);
    setCandidates(null);
    setStudentName("");
    setStudentEmail("");
    setStudentPhone("");
    setEnrollmentSuccess(null);
  }, [identifier, selectedContentId, contentType]);

  // Auto-select payment method based on balance
  useEffect(() => {
    if (checkData && !checkData.teacher.hasSufficientBalance) {
      setPaymentMethod("online");
    } else if (checkData && checkData.teacher.hasSufficientBalance) {
      setPaymentMethod((prev) =>
        prev === "online" && !checkData.teacher.hasSufficientBalance
          ? "online"
          : "balance"
      );
    }
  }, [checkData]);

  const handleContentTypeChange = (newType: 'test' | 'course' | 'product' | 'bundle') => {
    setContentType(newType);
    setSelectedContentId("");
    setCheckRequestId(0);
  };

  const handleCheck = () => {
    setIdentifierTouched(true);
    if (!isIdentifierValid) {
      return;
    }
    if (!selectedContentId) {
      toast.error(`Please select a ${contentLabel.toLowerCase()}`);
      return;
    }
    setSelectedStudentId(undefined);
    setCandidates(null);
    setCheckRequestId((n) => n + 1);
  };

  const handlePayURedirection = (payuData: {
    payuUrl: string;
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    phone: string;
    surl: string;
    furl: string;
    hash: string;
  }) => {
    try {
      postPaymentPayuRedirect(payuData);
    } catch (error) {
      console.error("Payment redirection failed:", error);
      toast.error("Failed to redirect to payment gateway");
      setIsRedirecting(false);
    }
  };

  const isBalanceSufficient = checkData?.teacher.hasSufficientBalance ?? false;
  const accountStatus = checkData?.user.status;
  const isNewUser = accountStatus === "not_found";
  const checkErrors = checkData?.errors ?? [];
  const isNameValid =
    !isNewUser || (isNewUser && studentName.trim().length > 0);
  const isFreeEnrollment = checkData?.isFreeEnrollment ?? false;
  // Force balance payment for free enrollments
  const effectivePaymentMethod: PaymentMethod = isFreeEnrollment ? "balance" : paymentMethod;

  const canEnroll =
    shouldCheck &&
    !isCheckError &&
    checkData?.isValid &&
    (accountStatus === "student" || accountStatus === "not_found") &&
    (isFreeEnrollment || effectivePaymentMethod === "online" || isBalanceSufficient) &&
    !isChecking &&
    !isEnrolling &&
    !isRedirecting &&
    isNameValid;

  const handleEnroll = () => {
    if (!canEnroll || !checkData || !contentIdToUse) return;

    const isNewUserLocal = checkData.user.status === "not_found";
    const payload = {
      identifier,
      contentId: contentIdToUse,
      contentType,
      paymentMethod: effectivePaymentMethod,
      ...(checkData.user.status === "student" && checkData.user.id ? { studentUserId: checkData.user.id } : {}),
      ...(isNewUserLocal && {
        studentName,
        studentEmail: studentEmail || undefined,
        studentPhone: studentPhone || undefined,
        sendCredentials,
      }),
    };

    enrollStudent(payload, {
      onSuccess: (data) => {
        if (!data.requiresPayment && data.newUserCreated) {
          setEnrollmentSuccess({
            phone: isEmailIdentifier ? studentPhone : (checkData.user.phoneNumber ?? identifier),
            email: isEmailIdentifier ? identifier : studentEmail,
            temporaryPassword: data.temporaryPassword,
            credentialsSent: data.credentialsSent,
          });
          toast.success("Student account created and enrolled!");
        } else if (data.requiresPayment && data.paymentData) {
          setIsRedirecting(true);
          handlePayURedirection(data.paymentData);
        } else {
          const contentTitle = currentOptions.find(
            (c) => c.id === contentIdToUse
          )?.title;
          const name = checkData.user.name || "Student";
          toast.success(`${name} has been enrolled in ${contentTitle}!`);
          onOpenChange(false);
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to enroll student");
        setIsRedirecting(false);
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatJoined = (date: Date | null) =>
    date ? new Date(date).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null;

  // Success View for New User
  if (enrollmentSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <SponsorSuccessView
          enrollmentSuccess={enrollmentSuccess}
          onClose={() => onOpenChange(false)}
        />
      </Dialog>
    );
  }

  // Enrollment Form View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Sponsor Student Enrollment</DialogTitle>
          <DialogDescription>
            Enroll a student in your content by paying the platform fee on
            their behalf.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.formContainer}>
          {!initialMockTestId && (
            <div className={styles.typeSelector}>
              <Button
                variant={contentType === "test" ? "primary" : "secondary"}
                onClick={() => handleContentTypeChange("test")}
                type="button"
                className={styles.typeButton}
              >
                Test Series
              </Button>
              <Button
                variant={contentType === "course" ? "primary" : "secondary"}
                onClick={() => handleContentTypeChange("course")}
                type="button"
                className={styles.typeButton}
              >
                Course
              </Button>
              <Button
                variant={contentType === "product" ? "primary" : "secondary"}
                onClick={() => handleContentTypeChange("product")}
                type="button"
                className={styles.typeButton}
              >
                Study Notes
              </Button>
              <Button
                variant={contentType === "bundle" ? "primary" : "secondary"}
                onClick={() => handleContentTypeChange("bundle")}
                type="button"
                className={styles.typeButton}
              >
                Bundle
              </Button>
            </div>
          )}

          {/* Content Selection */}
          {!initialMockTestId && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{contentLabel}</label>
              <Select
                value={selectedContentId}
                onValueChange={setSelectedContentId}
                disabled={isChecking || isEnrolling || isRedirecting}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select a paid ${contentType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingContent ? (
                    <div className={styles.loadingItem}>
                      <Spinner size="sm" /> Loading {contentType}s...
                    </div>
                  ) : currentOptions.length > 0 ? (
                    currentOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.title} ({formatCurrency(item.price)})
                      </SelectItem>
                    ))
                  ) : (
                    <div className={styles.loadingItem}>
                      No paid published {contentType}s available.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Student Identifier Input */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Student Mobile Number or Email</label>
            <div className={styles.phoneInputWrapper}>
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => setIdentifierTouched(true)}
                placeholder="Enter mobile number or email"
                disabled={isChecking || isEnrolling || isRedirecting}
                className={styles.identifierInput}
                aria-invalid={identifierHint ? true : undefined}
                aria-describedby={identifierHint ? "sponsor-identifier-hint" : undefined}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCheck}
                disabled={
                  !isIdentifierValid ||
                  !selectedContentId ||
                  isChecking ||
                  isEnrolling ||
                  isRedirecting
                }
                className={styles.checkButton}
                aria-busy={isChecking || undefined}
              >
                {isChecking ? (
                  <>
                    <Spinner size="sm" className={styles.buttonSpinner} />
                    Checking
                  </>
                ) : (
                  "Check"
                )}
              </Button>
            </div>
            {identifierHint && (
              <p id="sponsor-identifier-hint" className={styles.fieldHint} role="alert">
                {identifierHint}
              </p>
            )}
          </div>

          {/* Account picker: kept on screen while a pick is being re-checked */}
          {shouldCheck && !isCheckError && candidates && candidates.length > 1 && (
            <div className={styles.candidatePanel} role="radiogroup" aria-label="Choose a student account">
              <div className={styles.candidateHeading}>
                <Users size={16} />
                <span>
                  {candidates.length} student accounts use this {isEmailIdentifier ? "email" : "mobile number"}. Choose the one to sponsor.
                </span>
              </div>
              {candidates.map((c) => {
                const selected = selectedStudentId === c.id;
                const joined = formatJoined(c.joinedAt);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.candidate} ${selected ? styles.candidateSelected : ""}`}
                    onClick={() => setSelectedStudentId(c.id)}
                    disabled={isChecking || isEnrolling || isRedirecting}
                  >
                    <span className={styles.candidateName}>{c.name}</span>
                    <span className={styles.candidateMeta}>
                      {[c.maskedEmail, c.maskedPhone, joined ? `Joined ${joined}` : null, `ID ${c.id}`]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Validation result: exactly one state per lookup */}
          {shouldCheck && !isChecking && (
            <div className={styles.validationResult} aria-live="polite">
              {isCheckError ? (
                <div className={`${styles.alert} ${styles.error} ${styles.alertWithAction}`}>
                  <XCircle size={16} />
                  <span className={styles.alertText}>
                    {(checkError as Error)?.message || "Could not check this account. Please try again."}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => retryCheck()}>
                    <RefreshCw size={14} />
                    Try again
                  </Button>
                </div>
              ) : checkData ? (
                <>
                  {checkErrors.length > 0 ? (
                    <div className={`${styles.alert} ${styles.error}`}>
                      <XCircle size={16} />
                      <span>{checkErrors.join(" ")}</span>
                    </div>
                  ) : accountStatus === "student" ? (
                    <div className={`${styles.alert} ${styles.success}`}>
                      <CheckCircle2 size={16} />
                      <span>
                        Student account found: <strong>{checkData.user.name}</strong>
                      </span>
                    </div>
                  ) : accountStatus === "not_found" ? (
                    <div className={`${styles.alert} ${styles.info}`}>
                      <Info size={16} />
                      <span>
                        {checkData.message ||
                          "No account uses this identifier. A new student account will be created."}
                      </span>
                    </div>
                  ) : null}

                  {/* New User Fields */}
                  {isNewUser && checkData.isValid && (
                    <div className={styles.newUserFields}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                          Student Name{" "}
                          <span className={styles.required}>*</span>
                        </label>
                        <Input
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Enter student's full name"
                          disabled={isEnrolling || isRedirecting}
                        />
                      </div>

                      {/* If identifier is email, show optional phone field */}
                      {isEmailIdentifier ? (
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>
                            Mobile Number{" "}
                            <span className={styles.optional}>(Optional)</span>
                          </label>
                          <Input
                            type="tel"
                            value={studentPhone}
                            onChange={(e) => setStudentPhone(e.target.value)}
                            placeholder="10-digit mobile number"
                            disabled={isEnrolling || isRedirecting}
                            maxLength={10}
                          />
                        </div>
                      ) : (
                        /* If identifier is phone, show optional email field */
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>
                            Email{" "}
                            <span className={styles.optional}>(Optional)</span>
                          </label>
                          <Input
                            type="email"
                            value={studentEmail}
                            onChange={(e) => setStudentEmail(e.target.value)}
                            placeholder="student@example.com"
                            disabled={isEnrolling || isRedirecting}
                          />
                        </div>
                      )}

                      <div className={styles.checkboxWrapper}>
                        <Checkbox
                          id="send-credentials"
                          checked={sendCredentials}
                          onChange={(e) => setSendCredentials(e.target.checked)}
                          disabled={isEnrolling || isRedirecting}
                        />
                        <label
                          htmlFor="send-credentials"
                          className={styles.checkboxLabel}
                        >
                          Send login credentials via SMS
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  {checkData.isValid && (
                    <SponsorCostBreakdown
                      testPrice={checkData.cost.testPrice}
                      commissionAmount={checkData.cost.commissionAmount}
                      discountPrice={checkData.cost.discountPrice}
                      isFreeEnrollment={checkData.isFreeEnrollment}
                    />
                  )}

                  {/* Payment Selection — hidden for free enrollments */}
                  {checkData.isValid && !checkData.isFreeEnrollment && (
                    <SponsorPaymentMethodSelector
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                      isBalanceSufficient={
                        checkData.teacher.hasSufficientBalance
                      }
                      availableBalance={checkData.teacher.availableBalance}
                      commissionAmount={checkData.cost.commissionAmount}
                      disabled={isEnrolling || isRedirecting}
                      showBalanceOption={!isManager}
                    />
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isEnrolling || isRedirecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={!canEnroll}
            className={styles.enrollButton}
            variant={effectivePaymentMethod === "online" ? "primary" : "secondary"}
          >
            {isEnrolling || isRedirecting ? (
              <>
                <Spinner size="sm" className={styles.buttonSpinner} />
                {isRedirecting ? "Redirecting..." : "Processing..."}
              </>
            ) : (
              <>
                {isFreeEnrollment ? (
                  isNewUser ? "Create & Enroll" : "Enroll Student"
                ) : effectivePaymentMethod === "online" ? (
                  <>
                    Pay Now{" "}
                    <ExternalLink size={14} className={styles.btnIcon} />
                  </>
                ) : isNewUser ? (
                  "Create & Sponsor"
                ) : (
                  "Sponsor Student"
                )}
                {checkData?.isValid && !isFreeEnrollment && (
                  <span className={styles.buttonAmount}>
                    {" "}
                    - {formatCurrency(checkData.cost.commissionAmount)}
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};