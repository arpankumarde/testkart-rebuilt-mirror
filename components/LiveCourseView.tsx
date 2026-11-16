import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Info,
  Languages,
  Layers,
  ShieldCheck,
  Star,
  Timer,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { usePurchaseLiveCourseMutation, useRefundLiveCourseMutation } from "../helpers/useLiveCourses";
import { useQueryClient } from "@tanstack/react-query";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postPaymentCashfreeVerify } from "../endpoints/payment/cashfree/verify_POST.schema";
import type { OutputType as LiveCourseViewData } from "../endpoints/live-courses/get_GET.schema";
import { classroomPath, formatIstDate, formatIstShort, formatRupees } from "../helpers/liveCourseRules";
import { descriptionBlocks, scheduleSummary, splitLead } from "../helpers/liveCoursePresentation";
import { openClassroom } from "../helpers/openClassroom";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { LiveCourseCurriculum } from "./LiveCourseCurriculum";
import { LiveCourseInstructor, LiveCourseReviews } from "./LiveCourseInstructor";
import { LiveCourseRelated } from "./LiveCourseRelated";
import styles from "./LiveCourseView.module.css";

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
type Tone = "peach" | "mint" | "lavender" | "blue" | "butter" | "sage";

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
        else if (r.orderStatus === "refunded") toast.info("This payment could not get you a seat, so it is being refunded in full to your account.");
        else toast.error(r.message || "The payment did not go through.");
      })
      .catch((e) => {
        toast.dismiss(toastId);
        toast.error(e instanceof Error ? e.message : "Could not confirm the payment.");
      })
      .finally(() => queryClient.invalidateQueries({ queryKey: ["live-courses"] }));
  }, []);
}

/* Section title with a wobbly pastel icon blob and optional count pills, as on the course page. */
const SectionHead: React.FC<{ icon: React.ReactNode; tone: Tone; title: string; id: string; pills?: React.ReactNode }> = ({
  icon,
  tone,
  title,
  id,
  pills,
}) => (
  <div className={styles.sectionHead}>
    <span className={styles.sectionIcon} data-tone={tone} aria-hidden="true">
      <span className={styles.sectionBlob} />
      {icon}
    </span>
    <h2 id={id} className={styles.h2}>
      {title}
    </h2>
    {pills && <div className={styles.headPills}>{pills}</div>}
  </div>
);

export const LiveCourseView: React.FC<{ data: LiveCourseViewData }> = ({ data }) => {
  const { course, viewer, closedReason, seatsLeft, refundClosesAt } = data;
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const purchase = usePurchaseLiveCourseMutation();
  const refund = useRefundLiveCourseMutation();
  const profileQuery = useTeacherPublicProfileQuery(course.teacher.slug ?? "");
  const profile = profileQuery.data;
  const [refundOpen, setRefundOpen] = useState(false);
  const enrolled = viewer.enrollment?.status === "enrolled";
  const now = Date.now();
  const attended = useMemo(() => new Map(viewer.attendance.map((a) => [a.classId, a.present])), [viewer.attendance]);
  const discount = course.originalPrice && course.originalPrice > course.price ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;
  const nonStudent = authState.type === "authenticated" && authState.user.role !== "student";
  const canBuy = !enrolled && !closedReason && !nonStudent;

  const blocks = useMemo(() => descriptionBlocks(course.description ?? ""), [course.description]);
  const { lead, rest } = splitLead(blocks);
  const sched = useMemo(() => scheduleSummary(course.classes), [course.classes]);
  const topicCount = course.modules.reduce((n, m) => n + m.topics.length, 0);
  const heldMinutes = course.classes.filter((c) => c.status !== "cancelled").reduce((n, c) => n + c.durationMinutes, 0);

  const nextClass = enrolled
    ? course.classes.find((c) => c.status === "scheduled" && new Date(c.startTime).getTime() + (c.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * 60000 >= now)
    : undefined;
  const nextJoinable = !!nextClass && now >= new Date(nextClass.startTime).getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60000;

  /* The enrol bar appears once the card's CTA has scrolled out of view. */
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || !canBuy || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [canBuy]);
  const showBar = mounted && canBuy && !ctaVisible;

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
          <CheckCircle2 size={17} aria-hidden="true" /> You're enrolled
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
    if (nonStudent) {
      return <p className={styles.closed}>Only student accounts can enrol.</p>;
    }
    return (
      <button type="button" className={styles.buy} onClick={buy} disabled={purchase.isPending}>
        {purchase.isPending ? "Opening payment..." : `Enrol for ${formatRupees(course.price)}`}
      </button>
    );
  };

  const endsOn = course.endsOn ?? sched.last;
  const classMinutes = sched.minutes ?? course.defaultClassMinutes;
  const facts = [
    course.startsOn && { icon: <CalendarDays size={18} />, tone: "butter", label: "Starts", value: formatIstDate(course.startsOn) },
    sched.weeks && {
      icon: <CalendarRange size={18} />,
      tone: "blue",
      label: "Duration",
      value: `${sched.weeks} ${sched.weeks === 1 ? "week" : "weeks"}`,
      sub: endsOn ? `Ends ${formatIstDate(endsOn)}` : undefined,
    },
    (sched.days || sched.time) && {
      icon: <Clock size={18} />,
      tone: "lavender",
      label: "Schedule",
      value: sched.days ?? `${sched.time} IST`,
      sub: sched.days && sched.time ? `${sched.time} IST` : undefined,
    },
    course.classCount > 0 && {
      icon: <Video size={18} />,
      tone: "mint",
      label: "Format",
      value: `${course.classCount} live ${course.classCount === 1 ? "class" : "classes"}`,
      sub: "Online classroom",
    },
    classMinutes > 0 && { icon: <Timer size={18} />, tone: "peach", label: "Each class", value: `${classMinutes} min`, sub: "Live and interactive" },
    {
      icon: <Users size={18} />,
      tone: "sage",
      label: "Batch size",
      value: `Up to ${course.seatLimit}`,
      sub: course.seatLimit === 1 ? "student" : "students",
    },
  ].filter(Boolean) as { icon: React.ReactNode; tone: Tone; label: string; value: string; sub?: string }[];

  const hours = Math.round(heldMinutes / 6) / 10;
  const summary = [
    course.modules.length > 0 && `${course.modules.length} ${course.modules.length === 1 ? "subject" : "subjects"}`,
    topicCount > 0 && `${topicCount} ${topicCount === 1 ? "topic" : "topics"}`,
    course.classCount > 0 && `${course.classCount} live ${course.classCount === 1 ? "class" : "classes"}`,
    heldMinutes >= 60 && `${hours} ${hours === 1 ? "hr" : "hrs"} of teaching`,
  ].filter(Boolean) as string[];

  const teacherName = course.teacher.name;

  return (
    <div className={styles.root} data-bar={showBar || undefined}>
      <header className={styles.hero}>
        <div className={styles.heroInfo}>
          <div className={styles.kickerRow}>
            <span className={styles.kicker}>Live course</span>
            {course.examName && <span className={styles.examTag}>{course.examName}</span>}
          </div>
          <h1 className={styles.title}>{course.title}</h1>
          <div className={styles.pills}>
            <span className={styles.pill} data-tone="mint">
              <Award size={14} aria-hidden="true" /> {LEVEL[course.level] ?? course.level}
            </span>
            {course.languages.length > 0 && (
              <span className={styles.pill} data-tone="lavender">
                <Languages size={14} aria-hidden="true" /> {course.languages.join(", ")}
              </span>
            )}
            <a href="#lc-instructor" className={styles.hostPill}>
              {course.teacher.avatarUrl ? (
                <img src={course.teacher.avatarUrl} alt="" className={styles.hostAvatar} />
              ) : (
                <span className={styles.hostFallback} aria-hidden="true">
                  {teacherName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className={styles.hostLabel}>Taught by</span>
              <strong>{teacherName}</strong>
              {profile?.teacher.isVerified && <BadgeCheck size={15} className={styles.hostVerified} aria-label="Verified teacher" />}
            </a>
          </div>
          {lead && <p className={styles.lead}>{lead}</p>}
          {facts.length > 0 && (
            <ul className={styles.facts}>
              {facts.map((f) => (
                <li key={f.label} className={styles.fact}>
                  <span className={styles.factIcon} data-tone={f.tone} aria-hidden="true">
                    {f.icon}
                  </span>
                  <span className={styles.factText}>
                    <span className={styles.factLabel}>{f.label}</span>
                    <span className={styles.factValue}>{f.value}</span>
                    {f.sub && <span className={styles.factSub}>{f.sub}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className={styles.buyCard} aria-label="Enrolment">
          {course.thumbnailUrl && (
            <div className={styles.media}>
              <img src={course.thumbnailUrl} alt="" className={styles.cover} />
            </div>
          )}
          <div className={styles.cardBody}>
            <div className={styles.priceRow}>
              <span className={styles.price}>{formatRupees(course.price)}</span>
              {discount > 0 && (
                <>
                  <s className={styles.original}>{formatRupees(course.originalPrice!)}</s>
                  <span className={styles.off}>{discount}% off</span>
                </>
              )}
            </div>
            {discount > 0 && !enrolled && <p className={styles.save}>You save {formatRupees(course.originalPrice! - course.price)}</p>}

            {!enrolled && !closedReason && (
              <div className={styles.seats}>
                <div className={styles.seatsTop}>
                  <span className={styles.seatsText}>
                    <Users size={14} aria-hidden="true" />
                    <span>
                      <strong>{seatsLeft}</strong> of {course.seatLimit} {course.seatLimit === 1 ? "seat" : "seats"} left
                    </span>
                  </span>
                </div>
                {course.enrolledCount > 0 && (
                  <span className={styles.meter} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (course.enrolledCount / Math.max(1, course.seatLimit)) * 100)}%` }} />
                  </span>
                )}
                {course.registrationDeadline && (
                  <span className={styles.deadline}>
                    <Clock size={14} aria-hidden="true" /> Enrol by {formatIstShort(course.registrationDeadline)} IST
                  </span>
                )}
              </div>
            )}

            <div ref={ctaRef} className={styles.ctaSlot}>
              {cta()}
            </div>

            {nextClass && (
              <div className={styles.next}>
                <span className={styles.nextLabel}>Next class</span>
                <strong className={styles.nextTitle}>{nextClass.title}</strong>
                <span className={styles.nextTime}>
                  {formatIstShort(nextClass.startTime)} IST &middot; {nextClass.durationMinutes} min
                </span>
                {nextJoinable ? (
                  <Button size="sm" className={styles.nextJoin} onClick={() => openClassroom(classroomPath(nextClass.id))}>
                    <Video size={14} aria-hidden="true" /> Join class
                  </Button>
                ) : (
                  <span className={styles.nextHint}>Join opens {JOIN_WINDOW_MINUTES_BEFORE} min before it starts.</span>
                )}
              </div>
            )}

            <p className={styles.guarantee}>
              <ShieldCheck size={16} aria-hidden="true" />
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
              <p className={styles.muted}>Refunded{viewer.enrollment.refundedAt ? ` on ${formatIstDate(viewer.enrollment.refundedAt)}` : ""}.</p>
            )}
          </div>
        </aside>
      </header>

      <div className={styles.sections}>
        {rest.length > 0 && (
          <section className={styles.section} aria-labelledby="lc-overview">
            <SectionHead id="lc-overview" icon={<Info />} tone="lavender" title="About this course" />
            <div className={styles.prose}>
              {rest.map((b, i) =>
                b.kind === "p" ? (
                  <p key={i}>{b.text}</p>
                ) : (
                  <ul key={i} className={styles.proseList}>
                    {b.items.map((item, j) => (
                      <li key={j}>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </section>
        )}

        <section className={styles.section} aria-labelledby="lc-content">
          <SectionHead
            id="lc-content"
            icon={<Layers />}
            tone="blue"
            title="Course content"
            pills={summary.length > 0 ? <span className={styles.headMeta}>{summary.join(" · ")}</span> : undefined}
          />
          <LiveCourseCurriculum course={course} enrolled={enrolled} attended={attended} now={now} />
        </section>

        <section className={styles.section} id="lc-instructor" aria-labelledby="lc-instructor-title">
          <SectionHead id="lc-instructor-title" icon={<UserRound />} tone="mint" title="Your teacher" />
          <LiveCourseInstructor course={course} profile={profile} />
        </section>

        {profile && (
          <LiveCourseReviews
            teacherName={teacherName}
            profile={profile}
            wrap={(content) => (
              <section className={styles.section} aria-labelledby="lc-reviews">
                <SectionHead id="lc-reviews" icon={<Star />} tone="butter" title="Student reviews" />
                {content}
              </section>
            )}
          />
        )}

        <LiveCourseRelated course={course} />
      </div>

      {mounted &&
        canBuy &&
        createPortal(
          <div className={styles.enrolBar} data-visible={showBar || undefined} aria-hidden={!showBar}>
            <div className={styles.barInner}>
              <span className={styles.barTitle}>{course.title}</span>
              <span className={styles.barPrice}>
                <strong>{formatRupees(course.price)}</strong>
                {discount > 0 && <s>{formatRupees(course.originalPrice!)}</s>}
              </span>
              <button type="button" className={styles.buy} onClick={buy} disabled={purchase.isPending} tabIndex={showBar ? 0 : -1}>
                {purchase.isPending ? "Opening payment..." : "Enrol now"}
              </button>
            </div>
          </div>,
          document.body
        )}

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
