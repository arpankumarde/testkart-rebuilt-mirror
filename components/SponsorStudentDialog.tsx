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
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Info, RefreshCw, Users, Lock } from "lucide-react";
import type { SponsorshipAccessInfo } from "../endpoints/teacher/sponsor-student/list_GET.schema";
import { toast } from "sonner";
import { SponsorCostBreakdown } from "./SponsorCostBreakdown";
import { SponsorSuccessView } from "./SponsorSuccessView";
import styles from "./SponsorStudentDialog.module.css";

interface SponsorStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mockTestId?: number; // Optional pre-selected test
  /** Plan gate from the sponsored list; when not allowed the dialog shows the upgrade prompt. */
  access?: SponsorshipAccessInfo;
}

export const SponsorStudentDialog: React.FC<SponsorStudentDialogProps> = ({
  open,
  onOpenChange,
  mockTestId: initialMockTestId,
  access,
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

  const accountStatus = checkData?.user.status;
  const isNewUser = accountStatus === "not_found";
  const checkErrors = checkData?.errors ?? [];
  const isNameValid =
    !isNewUser || (isNewUser && studentName.trim().length > 0);

  // No payment step: the platform fee is waived, so a valid check is all enrolling needs.
  const canEnroll =
    shouldCheck &&
    !isCheckError &&
    checkData?.isValid &&
    (accountStatus === "student" || accountStatus === "not_found") &&
    !isChecking &&
    !isEnrolling &&
    isNameValid;

  const handleEnroll = () => {
    if (!canEnroll || !checkData || !contentIdToUse) return;

    const isNewUserLocal = checkData.user.status === "not_found";
    const payload = {
      identifier,
      contentId: contentIdToUse,
      contentType,
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
        if (data.newUserCreated) {
          setEnrollmentSuccess({
            phone: isEmailIdentifier ? studentPhone : (checkData.user.phoneNumber ?? identifier),
            email: isEmailIdentifier ? identifier : studentEmail,
            temporaryPassword: data.temporaryPassword,
            credentialsSent: data.credentialsSent,
          });
          toast.success("Student account created and enrolled!");
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

  if (access && !access.allowed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Sponsor Student Enrollment</DialogTitle>
            <DialogDescription>
              Enroll a student in your paid content for free. There is no
              platform fee on sponsored enrollments.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.upgradePanel}>
            <span className={styles.upgradeIcon} aria-hidden="true">
              <Lock size={18} />
            </span>
            <div className={styles.upgradeBody}>
              <p className={styles.upgradeTitle}>Available on the Starter plan and above</p>
              <p className={styles.upgradeText}>
                {isManager
                  ? "Sponsoring and directly enrolling students is not included in the Free plan. Ask the account owner to upgrade to Starter, Individual or Business."
                  : "Sponsoring and directly enrolling students is not included in the Free plan. Upgrade to Starter, Individual or Business to enroll students yourself."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {!isManager && (
              <Button asChild>
                <Link to="/teacher/subscription" onClick={() => onOpenChange(false)}>
                  See plans
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
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
            Enroll a student in your paid content for free. There is no
            platform fee on sponsored enrollments.
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
                disabled={isChecking || isEnrolling}
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
                disabled={isChecking || isEnrolling}
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
                  isEnrolling
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
                    disabled={isChecking || isEnrolling}
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
                          disabled={isEnrolling}
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
                            disabled={isEnrolling}
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
                            disabled={isEnrolling}
                          />
                        </div>
                      )}

                      <div className={styles.checkboxWrapper}>
                        <Checkbox
                          id="send-credentials"
                          checked={sendCredentials}
                          onChange={(e) => setSendCredentials(e.target.checked)}
                          disabled={isEnrolling}
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

                  {checkData.isValid && (
                    <SponsorCostBreakdown
                      testPrice={checkData.cost.testPrice}
                      discountPrice={checkData.cost.discountPrice}
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
            disabled={isEnrolling}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={!canEnroll}
            className={styles.enrollButton}
            variant="primary"
          >
            {isEnrolling ? (
              <>
                <Spinner size="sm" className={styles.buttonSpinner} />
                Enrolling...
              </>
            ) : isNewUser ? (
              "Create & Enroll"
            ) : (
              "Enroll Student"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};