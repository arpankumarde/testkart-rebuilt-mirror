import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, Users, IndianRupee, ArrowLeft, Video, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import {
  useMentorshipGroupLessonQuery,
  useMentorshipGroupLessonEnrollMutation,
  useMentorshipGroupLessonPurchaseMutation,
  useMentorshipGroupLessonUnenrollMutation,
  MENTORSHIP_GROUP_LESSONS_QUERY_KEY,
} from "../helpers/useMentorship";
import { GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { NotFoundState } from "../components/NotFoundState";
import { isNotFoundError } from "../helpers/isNotFoundError";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import styles from "./course.live.$id.module.css";

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

const formatWhen = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short" }).format(new Date(date));

const GroupLessonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const lessonId = id ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useMentorshipGroupLessonQuery(lessonId);
  const enrollMutation = useMentorshipGroupLessonEnrollMutation();
  const purchaseMutation = useMentorshipGroupLessonPurchaseMutation();
  const unenrollMutation = useMentorshipGroupLessonUnenrollMutation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [unenrollOpen, setUnenrollOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderIdParam = params.get("order_id");
    if (params.get("gateway") === "cashfree" && orderIdParam && !isVerifying) {
      const orderId = parseInt(orderIdParam, 10);
      if (isNaN(orderId)) return;
      window.history.replaceState({}, "", window.location.pathname);
      setIsVerifying(true);
      const toastId = toast.loading("Verifying payment...");
      postPaymentCashfreeVerify({ orderId })
        .then((result) => {
          toast.dismiss(toastId);
          if (result.success && result.orderStatus === "completed") {
            toast.success("Payment successful! You're enrolled.");
            queryClient.invalidateQueries({ queryKey: MENTORSHIP_GROUP_LESSONS_QUERY_KEY });
          } else if (result.orderStatus === "pending") {
            toast.warning("Payment is still pending. Please refresh in a moment.");
          } else {
            toast.error(`Payment verification failed: ${result.message}`);
          }
        })
        .catch((err) => {
          toast.dismiss(toastId);
          toast.error(err instanceof Error ? err.message : "Payment verification failed");
        })
        .finally(() => setIsVerifying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <Skeleton style={{ height: "1.5rem", width: "10rem" }} />
        <Skeleton style={{ height: "2rem", width: "min(28rem, 90%)" }} />
        <Skeleton style={{ height: "10rem", width: "100%" }} />
      </div>
    );
  }

  if (isError && isNotFoundError(error)) {
    return <NotFoundState kind="page" />;
  }

  if (isError || !data) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <p className={styles.errorText}>Could not load this group lesson. Please try again.</p>
      </div>
    );
  }

  const lesson = data.groupLesson;
  const isFree = lesson.pricePerLearner === 0;
  const isFull = lesson.enrolledCount >= lesson.maxCapacity;
  const hasStarted = new Date(lesson.startTime) < new Date();
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const isEnrolled = lesson.viewerEnrollmentStatus === "enrolled";
  const canEnroll = lesson.status === "scheduled" && !hasStarted && !isFull && !isEnrolled;

  const requireLogin = () => {
    toast.info("Please login to continue");
    navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
  };

  const handleFreeEnroll = () => {
    if (authState.type !== "authenticated") return requireLogin();
    enrollMutation.mutate(
      { groupLessonId: lesson.id },
      {
        onSuccess: () => toast.success("You're enrolled!"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not enroll"),
      }
    );
  };

  const handlePaidEnroll = async () => {
    if (authState.type !== "authenticated") return requireLogin();
    try {
      toast.loading("Initiating payment...");
      const paymentData = await purchaseMutation.mutateAsync({ groupLessonId: lesson.id });
      toast.dismiss();
      await startCashfreeCheckout(paymentData);
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    }
  };

  const handleUnenroll = () => {
    unenrollMutation.mutate(
      { groupLessonId: lesson.id },
      {
        onSuccess: () => {
          toast.success("You've been unenrolled.");
          setUnenrollOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not unenroll"),
      }
    );
  };

  return (
    <>
      <Helmet>
        <title>{`${lesson.title} | Live Group Class | Testkart`}</title>
        <meta name="description" content={lesson.description?.slice(0, 160) ?? `Join ${lesson.title} with ${lesson.teacherName} on Testkart.`} />
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
        <Link to={GROUP_LESSON_LIST_PATH} className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> All live classes
        </Link>

        {lesson.coverImageUrl && (
          <img src={lesson.coverImageUrl} alt="" className={styles.coverImage} />
        )}

        <div className={styles.headerRow}>
          {lesson.subject && <span className={styles.subjectTag}>{lesson.subject}</span>}
          {lesson.level && <span className={styles.levelTag}>{lesson.level}</span>}
        </div>

        <h1 className={styles.title}>{lesson.title}</h1>

        <div className={styles.teacherRow}>
          {lesson.teacherAvatarUrl ? (
            <img src={lesson.teacherAvatarUrl} alt="" className={styles.teacherAvatar} />
          ) : (
            <span className={styles.teacherAvatarFallback} aria-hidden="true">
              {lesson.teacherName.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className={styles.teacherName}>{lesson.teacherName}</p>
            {lesson.teacherBio && <p className={styles.teacherBio}>{lesson.teacherBio.slice(0, 140)}</p>}
          </div>
        </div>

        <div className={styles.factsGrid}>
          <div className={styles.factCard}>
            <CalendarDays size={16} aria-hidden="true" />
            <span>{formatWhen(lesson.startTime)}</span>
          </div>
          <div className={styles.factCard}>
            <Clock size={16} aria-hidden="true" />
            <span>{lesson.durationMinutes} minutes</span>
          </div>
          <div className={styles.factCard}>
            <Users size={16} aria-hidden="true" />
            <span>
              {lesson.enrolledCount}/{lesson.maxCapacity} enrolled
            </span>
          </div>
          <div className={styles.factCard}>
            <IndianRupee size={16} aria-hidden="true" />
            <span>{formatPrice(lesson.pricePerLearner)} per learner</span>
          </div>
        </div>

        {lesson.description && (
          <div className={styles.description}>
            <h2 className={styles.descriptionTitle}>About this session</h2>
            <p>{lesson.description}</p>
          </div>
        )}

        <div className={styles.ctaBar}>
          {lesson.status === "cancelled" ? (
            <p className={styles.statusMessage}>
              <XCircle size={16} aria-hidden="true" /> This group lesson was cancelled.
            </p>
          ) : lesson.status === "completed" ? (
            <p className={styles.statusMessage}>
              <CheckCircle size={16} aria-hidden="true" /> This group lesson has already taken place.
            </p>
          ) : isEnrolled ? (
            <div className={styles.enrolledBar}>
              <p className={`${styles.statusMessage} ${styles.statusOk}`}>
                <CheckCircle size={16} aria-hidden="true" /> You're enrolled in this lesson.
              </p>
              <div className={styles.enrolledActions}>
                {!hasStarted && (
                  <Button variant="outline" onClick={() => setUnenrollOpen(true)} disabled={unenrollMutation.isPending}>
                    Cancel enrollment
                  </Button>
                )}
                <Button onClick={() => navigate(`/mentorship/classroom/group/${lesson.id}`)}>
                  <Video size={16} aria-hidden="true" /> Go to classroom
                </Button>
              </div>
            </div>
          ) : hasStarted ? (
            <p className={styles.statusMessage}>This group lesson has already started.</p>
          ) : isFull ? (
            <p className={styles.statusMessage}>This group lesson is full.</p>
          ) : !isStudent && authState.type === "authenticated" ? (
            <p className={styles.statusMessage}>Only student accounts can enroll in group lessons.</p>
          ) : isFree ? (
            <Button size="lg" onClick={handleFreeEnroll} disabled={enrollMutation.isPending || !canEnroll}>
              {enrollMutation.isPending ? "Enrolling..." : "Enroll for free"}
            </Button>
          ) : (
            <Button size="lg" onClick={handlePaidEnroll} disabled={purchaseMutation.isPending || !canEnroll}>
              {purchaseMutation.isPending ? "Redirecting..." : `Pay ${formatPrice(lesson.pricePerLearner)} & enroll`}
            </Button>
          )}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={unenrollOpen}
        onOpenChange={setUnenrollOpen}
        title="Cancel your enrollment?"
        description="You'll lose your seat in this group lesson. If this was a paid session, refunds follow our standard cancellation policy."
        confirmLabel="Cancel enrollment"
        onConfirm={handleUnenroll}
        isPending={unenrollMutation.isPending}
      />
    </>
  );
};

export default GroupLessonDetailPage;
