import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { ArrowLeft, Clock, CheckCircle, Video, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useMentorshipTeacherOfferingsBySlugQuery, useMentorshipPurchaseMutation } from "../helpers/useMentorship";
import { useInvalidateLiveClasses, usePackageVerifyMutation } from "../helpers/useLivePackages";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import { formatRupees, LiveClassMinutes, LivePrices, trialPriceFor } from "../helpers/livePricing";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { NotFoundState } from "../components/NotFoundState";
import { LiveSlotPicker, useLiveSlotRange } from "../components/LiveSlotPicker";
import { LivePackageBuilder } from "../components/LivePackageBuilder";
import styles from "./live-teaching.book.$teacherSlug.module.css";

const STUDENT_CLASSES = "/student/live-teaching";

/**
 * One page per tutor at /live-teaching/book/<teacher slug>, in the order a student meets them: a
 * trial first (25 or 50 minutes), then a package of 1 to 6 classes a week paid by autopay. Returns
 * from Cashfree land here too.
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
              toast.success("Your package is active. Your classes are booked.");
              navigate(STUDENT_CLASSES);
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
          <LivePackageBuilder teacherId={teacher.id} teacherName={teacher.displayName} prices={data.prices} balance={data.balance ?? 0} />
        )}

        {stage === "package-active" && (
          <Notice
            title="You have a package with this teacher"
            text="Book, move or cancel your classes from your classes page."
            action="Open my classes"
            onAction={() => navigate(STUDENT_CLASSES)}
          />
        )}
      </div>
    </>
  );
};

export default BookMentorshipPage;

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
  const requested = Number(new URLSearchParams(location.search).get("duration"));
  const [minutes, setMinutes] = useState<LiveClassMinutes>(requested === 50 ? 50 : 25);
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
        {([25, 50] as const).map((m) => (
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
            <Clock size={14} aria-hidden="true" /> {m} min
            <span className={styles.durationPrice}>{trialPriceFor(prices, m) > 0 ? formatRupees(trialPriceFor(prices, m)) : "Free"}</span>
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
