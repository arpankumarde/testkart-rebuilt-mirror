import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock, Languages, ShieldCheck, Users, Video } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { usePurchaseLiveCourseMutation, useRefundLiveCourseMutation } from "../helpers/useLiveCourses";
import { useQueryClient } from "@tanstack/react-query";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import type { OutputType as LiveCourseViewData } from "../endpoints/live-courses/get_GET.schema";
import { classroomPath, formatIstDate, formatIstShort, formatRupees } from "../helpers/liveCourseRules";
import { openClassroom } from "../helpers/openClassroom";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import styles from "./LiveCourseView.module.css";

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

/** Settles a Cashfree return (?order_id=..&gateway=cashfree) once, then refreshes the course. */
export function useCashfreeReturn() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = Number(params.get("order_id"));
    if (params.get("gateway") !== "cashfree" || !orderId) return;
    window.history.replaceState({}, "", window.location.pathname);
    const toastId = toast.loading("Confirming your payment...");
    postPaymentCashfreeVerify({ orderId })
      .then((r) => {
        toast.dismiss(toastId);
        if (r.success && r.orderStatus === "completed") toast.success("Payment received. You're enrolled.");
        else if (r.orderStatus === "pending") toast.warning("Your payment is still being confirmed. Refresh in a minute.");
        else toast.error(r.message || "The payment did not go through.");
      })
      .catch((e) => {
        toast.dismiss(toastId);
        toast.error(e instanceof Error ? e.message : "Could not confirm the payment.");
      })
      .finally(() => queryClient.invalidateQueries({ queryKey: ["live-courses"] }));
  }, []);
}

export const LiveCourseView: React.FC<{ data: LiveCourseViewData }> = ({ data }) => {
  const { course, viewer, closedReason, seatsLeft, refundClosesAt } = data;
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const purchase = usePurchaseLiveCourseMutation();
  const refund = useRefundLiveCourseMutation();
  const [refundOpen, setRefundOpen] = useState(false);
  const enrolled = viewer.enrollment?.status === "enrolled";
  const now = Date.now();
  const activeClasses = course.classes.filter((c) => c.status !== "cancelled" || c.missed);
  const attended = new Map(viewer.attendance.map((a) => [a.classId, a.present]));
  const discount = course.originalPrice && course.originalPrice > course.price ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;

  const buy = async () => {
    if (authState.type !== "authenticated") {
      toast.info("Log in to enrol.");
      navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
      return;
    }
    try {
      const session = await purchase.mutateAsync(course.id);
      await startCashfreeCheckout(session);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the payment.");
    }
  };

  const cta = () => {
    if (enrolled) {
      return (
        <p className={styles.ok}>
          <CheckCircle2 size={16} aria-hidden="true" /> You're enrolled
        </p>
      );
    }
    if (closedReason) {
      const text = {
        full: "All seats are taken.",
        deadline: "Registration has closed.",
        not_open: "This course is not open yet.",
        ended: course.status === "cancelled" ? "This course was cancelled." : "This course has ended.",
      }[closedReason];
      return <p className={styles.closed}>{text}</p>;
    }
    if (authState.type === "authenticated" && authState.user.role !== "student") {
      return <p className={styles.closed}>Only student accounts can enrol.</p>;
    }
    return (
      <Button size="lg" className={styles.buy} onClick={buy} disabled={purchase.isPending}>
        {purchase.isPending ? "Opening payment..." : `Enrol for ${formatRupees(course.price)}`}
      </Button>
    );
  };

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {course.thumbnailUrl && <img src={course.thumbnailUrl} alt="" className={styles.cover} />}
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.live}`}>
            <Video size={13} aria-hidden="true" /> Live course
          </span>
          {course.examName && <span className={`${styles.chip} ${styles.exam}`}>{course.examName}</span>}
          <span className={`${styles.chip} ${styles.level}`}>{LEVEL[course.level] ?? course.level}</span>
        </div>
        <h1 className={styles.title}>{course.title}</h1>

        <div className={styles.facts}>
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {course.startsOn ? `${formatIstDate(course.startsOn)} to ${formatIstDate(course.endsOn ?? course.startsOn)}` : "Dates to be announced"}
          </span>
          <span>
            <Clock size={15} aria-hidden="true" /> {course.classCount} live {course.classCount === 1 ? "class" : "classes"}
          </span>
          {course.languages.length > 0 && (
            <span>
              <Languages size={15} aria-hidden="true" /> {course.languages.join(", ")}
            </span>
          )}
        </div>

        {course.description && (
          <section className={styles.section}>
            <h2 className={styles.h2}>About this course</h2>
            <p className={styles.about}>{course.description}</p>
          </section>
        )}

        {course.modules.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.h2}>Syllabus</h2>
            <ol className={styles.modules}>
              {course.modules.map((m) => (
                <li key={m.id} className={styles.module}>
                  <strong>{m.title}</strong>
                  {m.topics.length > 0 && (
                    <ul>
                      {m.topics.map((t) => (
                        <li key={t.id}>{t.title}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.h2}>Timetable</h2>
          {activeClasses.length === 0 ? (
            <p className={styles.muted}>Classes will be announced soon.</p>
          ) : (
            <ul className={styles.classes}>
              {course.classes.map((c) => {
                const start = new Date(c.startTime).getTime();
                const end = start + c.durationMinutes * 60000;
                const joinable =
                  enrolled &&
                  c.status === "scheduled" &&
                  now >= start - JOIN_WINDOW_MINUTES_BEFORE * 60000 &&
                  now <= end + JOIN_WINDOW_MINUTES_AFTER * 60000;
                const past = end < now;
                const mark = attended.get(c.id);
                return (
                  <li key={c.id} className={`${styles.class} ${c.status === "cancelled" ? styles.cancelled : ""}`}>
                    <div className={styles.classInfo}>
                      <strong>{c.title}</strong>
                      <span className={styles.muted}>
                        {formatIstShort(c.startTime)} IST &middot; {c.durationMinutes} min
                      </span>
                    </div>
                    <div className={styles.classSide}>
                      {c.status === "cancelled" ? (
                        <span className={`${styles.tag} ${styles.tagPeach}`}>{c.missed ? "Not held" : "Cancelled"}</span>
                      ) : joinable ? (
                        <Button size="sm" onClick={() => openClassroom(classroomPath(c.id))}>
                          <Video size={14} aria-hidden="true" /> Join
                        </Button>
                      ) : enrolled && past ? (
                        <span className={`${styles.tag} ${mark ? styles.tagMint : styles.tagMuted}`}>{mark ? "Attended" : "Missed"}</span>
                      ) : past ? (
                        <span className={`${styles.tag} ${styles.tagMuted}`}>Done</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Your teacher</h2>
          <Link to={course.teacher.slug ? `/expert/${course.teacher.slug}` : "#"} className={styles.teacher}>
            {course.teacher.avatarUrl ? (
              <img src={course.teacher.avatarUrl} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {course.teacher.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{course.teacher.name}</strong>
              {course.teacherTagline && <span className={styles.muted}>{course.teacherTagline}</span>}
            </span>
          </Link>
        </section>
      </div>

      <aside className={styles.side}>
        <div className={styles.buyCard}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatRupees(course.price)}</span>
            {discount > 0 && (
              <>
                <s className={styles.original}>{formatRupees(course.originalPrice!)}</s>
                <span className={styles.off}>{discount}% off</span>
              </>
            )}
          </div>
          {!enrolled && !closedReason && (
            <p className={styles.seats}>
              <Users size={14} aria-hidden="true" /> {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left
              {course.registrationDeadline ? ` · enrol by ${formatIstShort(course.registrationDeadline)}` : ""}
            </p>
          )}
          {cta()}
          <p className={styles.guarantee}>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>
              Full refund if you ask before the 3rd class starts
              {refundClosesAt ? ` (${formatIstShort(refundClosesAt)} IST)` : ""}. Joining after that has no refund.
            </span>
          </p>
          {enrolled && viewer.canRefund && (
            <Button variant="outline" onClick={() => setRefundOpen(true)}>
              Ask for a refund
            </Button>
          )}
          {viewer.enrollment?.status === "refunded" && (
            <p className={styles.muted}>
              Refunded{viewer.enrollment.refundedAt ? ` on ${formatIstDate(viewer.enrollment.refundedAt)}` : ""}.
            </p>
          )}
        </div>
      </aside>

      <ConsoleConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title="Get your money back?"
        description={`We refund ${formatRupees(viewer.enrollment ? course.price : 0)} to your original payment method and you leave the course. This cannot be undone.`}
        tone="destructive"
        confirmLabel="Refund and leave"
        pendingLabel="Refunding..."
        isPending={refund.isPending}
        onConfirm={() =>
          refund.mutate(course.id, {
            onSuccess: (r) => {
              toast.success(`Refund of ${formatRupees(r.amount)} started. It reaches you in 5 to 7 working days.`);
              setRefundOpen(false);
            },
            onError: (e) => {
              toast.error(e instanceof Error ? e.message : "Could not start the refund.");
              setRefundOpen(false);
            },
          })
        }
      />
    </div>
  );
};
