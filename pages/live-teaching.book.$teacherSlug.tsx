import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { ArrowLeft, Clock, CheckCircle, Video, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useMentorshipTeacherOfferingsBySlugQuery, useMentorshipPurchaseMutation } from "../helpers/useMentorship";
import { useInvalidateLiveClasses, useLivePackagesQuery, usePackageVerifyMutation } from "../helpers/useLivePackages";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import { classLengthName, formatRupees, LiveClassMinutes, LivePrices, trialPriceFor } from "../helpers/livePricing";
import { MENTORSHIP_SESSION_DURATIONS } from "../helpers/liveLessonConfig";
import { requestedSessionMinutes } from "../helpers/liveBookingRoutes";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { NotFoundState } from "../components/NotFoundState";
import { LiveSlotPicker, useLiveSlotRange } from "../components/LiveSlotPicker";
import { LivePackageBuilder } from "../components/LivePackageBuilder";
import { LivePackageScheduler } from "../components/LivePackageScheduler";
import styles from "./live-teaching.book.$teacherSlug.module.css";

const STUDENT_CLASSES = "/student/live-teaching";

/**
 * One page per tutor at /live-teaching/book/<teacher slug>, in the order a student meets them: a
 * trial first (short session of 25 minutes or full session of 50), then a package of 1 to 6
 * classes a week paid by autopay, then picking times for the paid classes. Returns from Cashfree
 * land here too, so a paid package goes straight on to picking its times.
 */
const BookMentorshipPage: React.FC = () => {
  const { teacherSlug = null } = useParams<{ teacherSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const invalidate = useInvalidateLiveClasses();
  const offeringsQuery = useMentorshipTeacherOfferingsBySlugQuery(teacherSlug);
  const verifyPackage = usePackageVerifyMutation();
  const [confirming, setConfirming] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.search);
    const gateway = params.get("gateway");
    const orderId = Number(params.get("order_id"));
    const packageId = params.get("package");
    if (gateway === "cashfree" && orderId) {
      started.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      setConfirming("Confirming your payment...");
      postPaymentCashfreeVerify({ orderId })
        .then(async (result) => {
          await invalidate();
          if (result.orderStatus === "completed") {
            toast.success("Your trial class is booked.");
            navigate(STUDENT_CLASSES);
          } else if (result.orderStatus === "pending") {
            toast.warning("Your payment is still being confirmed. Check your classes in a minute.");
          } else if (result.orderStatus === "refunded") {
            toast.info("That checkout had already been replaced, so this payment is being refunded in full. Please book again.");
          } else {
            toast.error(result.message || "The payment did not go through.");
          }
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not check the payment."))
        .finally(() => setConfirming(null));
    } else if (gateway === "cashfree_mandate" && packageId) {
      started.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      setConfirming("Confirming your autopay...");
      const attempt = (left: number) => {
        verifyPackage
          .mutateAsync({ packageId })
          .then(async (result) => {
            if (result.status === "pending" && left > 0) {
              setTimeout(() => attempt(left - 1), 4000);
              return;
            }
            setConfirming(null);
            await invalidate();
            if (result.status === "active") {
              toast.success("Payment done. Now pick your class times.");
            } else if (result.status === "pending") {
              toast.warning("Your bank is still confirming autopay. We will email you once it is done.");
            } else {
              toast.error(result.message || "Autopay was not set up. Nothing was charged.");
            }
          })
          .catch((err) => {
            setConfirming(null);
            toast.error(err instanceof Error ? err.message : "Could not check the payment.");
          });
      };
      attempt(6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!teacherSlug) return <NotFoundState kind="page" />;

  if (confirming) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <div className={styles.successBox}>
          <Loader2 size={32} className={`${styles.successIcon} ${styles.spin}`} aria-hidden="true" />
          <h1 className={styles.successTitle}>{confirming}</h1>
          <p className={styles.successText}>This takes a few seconds. Please keep this page open.</p>
        </div>
      </div>
    );
  }

  if (offeringsQuery.isLoading) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <Skeleton style={{ height: "1.5rem", width: "10rem" }} />
        <Skeleton style={{ height: "10rem", width: "100%" }} />
      </div>
    );
  }

  const data = offeringsQuery.data;
  if (offeringsQuery.isError || !data || !data.enabled || !data.prices) {
    return <NotFoundState kind="page" />;
  }

  const teacher = data.teacher;
  const signedIn = authState.type === "authenticated";
  const stage = data.activePackageId
    ? "package-active"
    : data.trialState === "done"
      ? "package"
      : data.trialState === "booked"
        ? "trial-booked"
        : "trial";

  const heading =
    stage === "package"
      ? `Keep learning with ${teacher.displayName}`
      : stage === "trial" || stage === "trial-booked"
        ? `Trial class with ${teacher.displayName}`
        : `Your classes with ${teacher.displayName}`;

  return (
    <>
      <Helmet>
        <title>{`${heading} | Testkart`}</title>
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
        <Link to="/expert" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> All tutors
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
            <h1 className={styles.title}>{heading}</h1>
            {stage === "trial" && (
              <p className={styles.trialBadge}>
                <Sparkles size={13} aria-hidden="true" /> Start with one trial class
              </p>
            )}
          </div>
        </div>

        {stage === "trial" && (
          <TrialBooking
            teacherId={teacher.id}
            prices={data.prices}
            balance={data.balance ?? 0}
            signedIn={signedIn}
            onLogin={() => navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`)}
            onBooked={async () => {
              await invalidate();
              toast.success("Your trial class is booked.");
              navigate(STUDENT_CLASSES);
            }}
          />
        )}

        {stage === "trial-booked" && (
          <Notice
            title="Your trial is booked"
            text={`After your trial you can pick a plan with ${teacher.displayName} right here.`}
            action="See my classes"
            onAction={() => navigate(STUDENT_CLASSES)}
          />
        )}

        {stage === "package" && (
          <LivePackageBuilder
            teacherId={teacher.id}
            teacherName={teacher.displayName}
            prices={data.prices}
            balance={data.balance ?? 0}
            maxClassesPerWeek={data.maxClassesPerWeek}
          />
        )}

        {stage === "package-active" && <PackageTimes teacherId={teacher.id} onFinished={() => navigate(STUDENT_CLASSES)} />}
      </div>
    </>
  );
};

export default BookMentorshipPage;

/** After paying: the paid classes still waiting for a time, picked here; otherwise a pointer to the classes page. */
const PackageTimes: React.FC<{ teacherId: number; onFinished: () => void }> = ({ teacherId, onFinished }) => {
  const packagesQuery = useLivePackagesQuery();
  const pkg = packagesQuery.data?.packages.find((p) => p.teacher.id === teacherId);
  if (packagesQuery.isLoading) return <Skeleton style={{ height: "12rem", width: "100%" }} />;
  if (!pkg || pkg.waitingCredits.length === 0) {
    return (
      <Notice
        title="You have a package with this teacher"
        text="Book, move or cancel your classes from your classes page."
        action="Open my classes"
        onAction={onFinished}
      />
    );
  }
  return (
    <>
      <p className={styles.successText}>
        {pkg.waitingCredits.length} paid class{pkg.waitingCredits.length > 1 ? "es" : ""} to book. Pick a day and a time and we repeat it every week.
      </p>
      <LivePackageScheduler pkg={pkg} onDone={(left) => left === 0 && onFinished()} />
    </>
  );
};

const Notice: React.FC<{ title: string; text: string; action: string; onAction: () => void }> = ({ title, text, action, onAction }) => (
  <div className={styles.successBox}>
    <CheckCircle size={32} className={styles.successIcon} aria-hidden="true" />
    <h2 className={styles.successTitle}>{title}</h2>
    <p className={styles.successText}>{text}</p>
    <div className={styles.successActions}>
      <Button onClick={onAction}>
        <Video size={16} aria-hidden="true" /> {action}
      </Button>
    </div>
  </div>
);

const TrialBooking: React.FC<{
  teacherId: number;
  prices: LivePrices;
  balance: number;
  signedIn: boolean;
  onLogin: () => void;
  onBooked: () => void;
}> = ({ teacherId, prices, balance, signedIn, onLogin, onBooked }) => {
  const location = useLocation();
  const requested = requestedSessionMinutes(location.search);
  const [minutes, setMinutes] = useState<LiveClassMinutes>(
    MENTORSHIP_SESSION_DURATIONS.find((m) => m === requested) ?? MENTORSHIP_SESSION_DURATIONS[0]
  );
  const [picked, setPicked] = useState<number[]>([]);
  const range = useLiveSlotRange(21);
  const purchase = useMentorshipPurchaseMutation();

  const price = trialPriceFor(prices, minutes);
  const fromBalance = Math.min(Math.max(balance, 0), price);
  const toPay = price - fromBalance;

  const book = async () => {
    if (!signedIn) {
      toast.info("Please log in to book a trial.");
      return onLogin();
    }
    if (picked.length === 0) return;
    try {
      const result = await purchase.mutateAsync({ teacherId, durationMinutes: minutes, startTime: new Date(picked[0]) });
      if (result.kind === "completed") return onBooked();
      await startCashfreeCheckout(result.session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book the trial.");
    }
  };

  return (
    <>
      <div className={styles.durationRow}>
        {MENTORSHIP_SESSION_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={minutes === m}
            className={`${styles.durationButton} ${minutes === m ? styles.durationButtonSelected : ""}`}
            onClick={() => {
              setMinutes(m);
              setPicked([]);
            }}
          >
            <span className={styles.durationLabel}>
              <span className={styles.durationName}>
                <Clock size={14} aria-hidden="true" /> {classLengthName(m)}
              </span>
              <span className={styles.durationMins}>{m} min</span>
            </span>
            <span className={styles.durationPrice}>{formatRupees(trialPriceFor(prices, m))}</span>
          </button>
        ))}
      </div>

      <LiveSlotPicker
        teacherId={teacherId}
        minutes={minutes}
        range={range}
        mode="single"
        selected={picked}
        onChange={setPicked}
        emptyText="No open times in the next 3 weeks. Please check back later."
      />

      <div className={styles.ctaBar}>
        {fromBalance > 0 && <p className={styles.balanceNote}>{formatRupees(fromBalance)} comes from your live class balance.</p>}
        <Button size="lg" disabled={picked.length === 0 || purchase.isPending} onClick={book}>
          {purchase.isPending ? "Booking..." : toPay > 0 ? `Pay ${formatRupees(toPay)} and book trial` : "Book trial"}
        </Button>
      </div>
    </>
  );
};
