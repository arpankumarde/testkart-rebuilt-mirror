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
  useEarningsBalance,
} from "../helpers/useTeacherSponsoredEnrollments";
import { useTeacherTestsQuery } from "../helpers/useTeacherTestsQuery";
import { useTeacherCoursesQuery } from "../helpers/useTeacherCoursesQuery";
import { useTeacherProductsQuery } from "../helpers/useTeacherProductsQuery";
import { useTeacherBundlesQuery } from "../helpers/useTeacherBundlesQuery";
import { CheckCircle2, XCircle, Info, ExternalLink } from "lucide-react";
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
  const [checkTriggered, setCheckTriggered] = useState(false);

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
  const { data: _balanceData } = useEarningsBalance();

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

  // Identifier is valid if it's a 10-digit number or contains @
  const isIdentifierValid =
    identifier.includes("@")
      ? identifier.length >= 3
      : identifier.replace(/\D/g, "").length === 10;

  const isEmailIdentifier = identifier.includes("@");

  const shouldCheck =
    checkTriggered && isIdentifierValid && contentIdToUse !== null;

  const {
    data: checkData,
    isLoading: isChecking,
    error: checkError,
    isError: isCheckError,
  } = useSponsorCheck(identifier, contentIdToUse, contentType, shouldCheck);

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
      setCheckTriggered(false);
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

  // Reset check trigger when inputs change
  useEffect(() => {
    setCheckTriggered(false);
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
    setCheckTriggered(false);
  };

  const handleCheck = () => {
    if (!isIdentifierValid) {
      toast.error("Please enter a valid 10-digit mobile number or email address");
      return;
    }
    if (!selectedContentId) {
      toast.error(`Please select a ${contentLabel.toLowerCase()}`);
      return;
    }
    setCheckTriggered(true);
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
  const isNewUser = checkData && !checkData.user.exists;
  const isNameValid =
    !isNewUser || (isNewUser && studentName.trim().length > 0);
  const isFreeEnrollment = checkData?.isFreeEnrollment ?? false;
  // Force balance payment for free enrollments
  const effectivePaymentMethod: PaymentMethod = isFreeEnrollment ? "balance" : paymentMethod;

  const canEnroll =
    checkData?.isValid &&
    (isFreeEnrollment || effectivePaymentMethod === "online" || isBalanceSufficient) &&
    !isChecking &&
    !isEnrolling &&
    !isRedirecting &&
    isNameValid;

  const handleEnroll = () => {
    if (!checkData?.isValid || !contentIdToUse) return;

    const isNewUserLocal = !checkData.user.exists;
    const payload = {
      identifier,
      contentId: contentIdToUse,
      contentType,
      paymentMethod: effectivePaymentMethod,
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
                placeholder="Enter mobile number or email"
                disabled={isChecking || isEnrolling || isRedirecting}
                className={styles.identifierInput}
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
              >
                {isChecking ? <Spinner size="sm" /> : "Check"}
              </Button>
            </div>
          </div>

          {/* Validation Results */}
          {shouldCheck && !isChecking && (
            <div className={styles.validationResult}>
              {isCheckError ? (
                <div className={`${styles.alert} ${styles.error}`}>
                  <XCircle size={16} />
                  <span>
                    {(checkError as Error)?.message || "Validation failed"}
                  </span>
                </div>
              ) : checkData ? (
                <>
                  {/* User Status */}
                  <div
                    className={`${styles.alert} ${
                      checkData.user.exists ? styles.success : styles.info
                    }`}
                  >
                    {checkData.user.exists ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>
                          User Found: <strong>{checkData.user.name}</strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <Info size={16} />
                        <span>
                          {checkData.message ||
                            "This identifier is not registered. A new student account will be created."}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Errors */}
                  {checkData.errors && checkData.errors.length > 0 && (
                    <div className={`${styles.alert} ${styles.error}`}>
                      <XCircle size={16} />
                      <span>{checkData.errors.join(" ")}</span>
                    </div>
                  )}

                  {/* New User Fields */}
                  {isNewUser && (
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