import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, IndianRupee, CalendarDays, CheckCircle, Video, Sparkles } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import {
  useMentorshipTeacherOfferingsQuery,
  useMentorshipSlotsQuery,
  useMentorshipPurchaseMutation,
  useMentorshipBookingCreateMutation,
  MENTORSHIP_BOOKINGS_QUERY_KEY,
} from "../helpers/useMentorship";
import { GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";
import { postPaymentPayuRedirect } from "../endpoints/payment/payu/redirect_POST.schema";
import { postPaymentPayuVerifyAndComplete } from "../endpoints/payment/payu/verify-and-complete_POST.schema";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { NotFoundState } from "../components/NotFoundState";
import styles from "./live-teaching.book.$teacherId.module.css";

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA").format(date);

const BookMentorshipPage: React.FC = () => {
  const { teacherId: teacherIdParam } = useParams<{ teacherId: string }>();
  const teacherId = teacherIdParam ? parseInt(teacherIdParam, 10) : null;
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const queryClient = useQueryClient();

  const offeringsQuery = useMentorshipTeacherOfferingsQuery(teacherId);
  const durations = offeringsQuery.data?.durations ?? [];
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (durations.length > 0 && durationMinutes === null) {
      // The profile's length tiles link here with ?duration=<minutes>.
      const requested = Number(new URLSearchParams(location.search).get("duration"));
      const match = durations.find((d) => d.durationMinutes === requested);
      setDurationMinutes((match ?? durations[0]).durationMinutes);
    }
  }, [durations, durationMinutes, location.search]);

  const selectedDuration = durations.find((d) => d.durationMinutes === durationMinutes) ?? null;

  const [selectedSlot, setSelectedSlot] = useState<{ startTime: Date; endTime: Date } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [justBookedFree, setJustBookedFree] = useState(false);
  const [justBookedTrial, setJustBookedTrial] = useState(false);

  const slotsQuery = useMentorshipSlotsQuery(teacherId, durationMinutes);
  const purchaseMutation = useMentorshipPurchaseMutation();
  const createBookingMutation = useMentorshipBookingCreateMutation();

  // The slot list depends on duration, so switching duration clears any slot picked for the old one.
  useEffect(() => {
    setSelectedSlot(null);
  }, [durationMinutes]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, { startTime: Date; endTime: Date }[]>();
    for (const slot of slotsQuery.data?.slots ?? []) {
      const start = new Date(slot.startTime);
      const key = dayKey(start);
      const existing = groups.get(key) ?? [];
      existing.push({ startTime: start, endTime: new Date(slot.endTime) });
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slotsQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const orderIdParam = params.get("order_id");
    const txnid = params.get("txnid");
    if (status === "success" && orderIdParam && !isVerifying) {
      const orderId = parseInt(orderIdParam, 10);
      if (isNaN(orderId)) return;
      window.history.replaceState({}, "", window.location.pathname);
      setIsVerifying(true);
      const toastId = toast.loading("Verifying payment...");
      postPaymentPayuVerifyAndComplete({ txnid: txnid ?? undefined, orderId })
        .then((result) => {
          toast.dismiss(toastId);
          if (result.success && result.orderStatus === "completed") {
            toast.success("Payment successful! Your session is booked.");
            queryClient.invalidateQueries({ queryKey: MENTORSHIP_BOOKINGS_QUERY_KEY });
            navigate("/student/live-teaching");
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

  if (!teacherId) {
    return <NotFoundState kind="page" />;
  }

  if (offeringsQuery.isLoading) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <Skeleton style={{ height: "1.5rem", width: "10rem" }} />
        <Skeleton style={{ height: "10rem", width: "100%" }} />
      </div>
    );
  }

  if (offeringsQuery.isError || !offeringsQuery.data || !offeringsQuery.data.enabled || durations.length === 0) {
    return <NotFoundState kind="page" />;
  }

  const teacher = offeringsQuery.data.teacher;
  const isTrialEligible = offeringsQuery.data.isTrialEligible;
  const isFree = (selectedDuration?.price ?? 0) === 0;

  const requireLogin = () => {
    toast.info("Please login to book a session");
    navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
  };

  const handleFreeBook = () => {
    if (!selectedSlot || durationMinutes === null) return;
    if (authState.type !== "authenticated") return requireLogin();
    createBookingMutation.mutate(
      { teacherId, durationMinutes, startTime: selectedSlot.startTime },
      {
        onSuccess: (result) => {
          setJustBookedFree(true);
          setJustBookedTrial(result.isTrial);
          toast.success("Session booked!");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not book this slot"),
      }
    );
  };

  const handlePaidBook = async () => {
    if (!selectedSlot || durationMinutes === null) return;
    if (authState.type !== "authenticated") return requireLogin();
    try {
      toast.loading("Initiating payment...");
      const paymentData = await purchaseMutation.mutateAsync({
        teacherId,
        durationMinutes,
        startTime: selectedSlot.startTime,
      });
      toast.dismiss();
      postPaymentPayuRedirect(paymentData);
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    }
  };

  if (justBookedFree) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <div className={styles.successBox}>
          <CheckCircle size={32} className={styles.successIcon} aria-hidden="true" />
          <h1 className={styles.successTitle}>Your session is booked!</h1>
          <p className={styles.successText}>
            {justBookedTrial ? "Your trial session" : "Your session"} with {teacher.displayName} is confirmed.
          </p>
          <div className={styles.successActions}>
            <Button onClick={() => navigate("/student/live-teaching")}>
              <Video size={16} aria-hidden="true" /> Go to my sessions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`Book a 1:1 session with ${teacher.displayName} | Testkart`}</title>
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
        <Link to={GROUP_LESSON_LIST_PATH} className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> All live teaching
        </Link>

        <div className={styles.header}>
          {teacher.avatarUrl ? (
            <img src={teacher.avatarUrl} alt="" className={styles.teacherAvatar} />
          ) : (
            <span className={styles.teacherAvatarFallback} aria-hidden="true">
              {teacher.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className={styles.title}>1:1 session with {teacher.displayName}</h1>
            {isTrialEligible && (
              <p className={styles.trialBadge}>
                <Sparkles size={13} aria-hidden="true" /> Your first session with this teacher is a trial
              </p>
            )}
          </div>
        </div>

        <div className={styles.durationRow}>
          {durations.map((d) => (
            <button
              key={d.durationMinutes}
              type="button"
              className={`${styles.durationButton} ${durationMinutes === d.durationMinutes ? styles.durationButtonSelected : ""}`}
              onClick={() => setDurationMinutes(d.durationMinutes)}
            >
              <Clock size={14} aria-hidden="true" /> {d.durationMinutes} min
              <span className={styles.durationPrice}>
                <IndianRupee size={13} aria-hidden="true" /> {formatPrice(d.price)}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.slotsSection}>
          <h2 className={styles.slotsTitle}>
            <CalendarDays size={16} aria-hidden="true" /> Pick a time ({teacher.timezone})
          </h2>

          {slotsQuery.isLoading ? (
            <Skeleton style={{ height: "8rem", width: "100%" }} />
          ) : slotsByDay.length === 0 ? (
            <p className={styles.noSlots}>No open slots in the next 3 weeks. Please check back later.</p>
          ) : (
            <div className={styles.dayList}>
              {slotsByDay.map(([key, slots]) => (
                <div key={key} className={styles.dayGroup}>
                  <p className={styles.dayLabel}>
                    {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
                      slots[0].startTime
                    )}
                  </p>
                  <div className={styles.slotGrid}>
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.startTime.getTime() === slot.startTime.getTime();
                      return (
                        <button
                          key={slot.startTime.toISOString()}
                          type="button"
                          className={`${styles.slotButton} ${isSelected ? styles.slotButtonSelected : ""}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(slot.startTime)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.ctaBar}>
          {isFree ? (
            <Button size="lg" disabled={!selectedSlot || createBookingMutation.isPending} onClick={handleFreeBook}>
              {createBookingMutation.isPending ? "Booking..." : "Confirm free booking"}
            </Button>
          ) : (
            <Button size="lg" disabled={!selectedSlot || purchaseMutation.isPending} onClick={handlePaidBook}>
              {purchaseMutation.isPending ? "Redirecting..." : `Pay ${formatPrice(selectedDuration?.price ?? 0)} & book`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default BookMentorshipPage;
