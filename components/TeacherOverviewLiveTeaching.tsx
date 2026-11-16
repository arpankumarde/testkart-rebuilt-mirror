import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  Hourglass,
  Video,
} from "lucide-react";
import { Button } from "./Button";
import { StatusPill } from "./LiveField";
import { useLiveTeachingStatusPeek } from "../helpers/useLiveTeaching";
import { useMentorshipBookingsQuery } from "../helpers/useTeacherMentorship";
import { firstOpenStep, formatDay } from "../helpers/liveTeachingForms";
import type { MentorshipBookingRow } from "../endpoints/mentorship/bookings/list_GET.schema";
import styles from "./TeacherOverviewLiveTeaching.module.css";

const OTHERS_SHOWN = 3;
const KIND_LABEL: Record<MentorshipBookingRow["kind"], string> = {
  trial: "Trial class",
  package: "Package class",
  single: "1:1 session",
};

const dayLabel = (date: Date) => {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const timeLabel = (date: Date) =>
  new Date(date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/* "Live now" from the start until the end, "Starting soon" in the 15 minutes before. */
const timing = (b: MentorshipBookingRow): { label: string; tone: "mint" | "butter" | "blue" } => {
  const start = new Date(b.scheduledAt).getTime();
  const now = Date.now();
  if (now >= start && now < start + b.durationMinutes * 60_000) return { label: "Live now", tone: "mint" };
  if (start - now <= 15 * 60_000 && start > now) return { label: "Starting soon", tone: "butter" };
  return { label: "Scheduled", tone: "blue" };
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const Avatar: React.FC<{ name: string; url: string | null; large?: boolean }> = ({ name, url, large }) =>
  url ? (
    <img src={url} alt="" className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} />
  ) : (
    <span className={`${styles.avatar} ${styles.avatarEmpty} ${large ? styles.avatarLarge : ""}`} aria-hidden="true">
      {initials(name) || "S"}
    </span>
  );

type FeatureTone = "blue" | "lavender" | "butter";

/*
 * One compact row for every live teaching state before approval: a tilted
 * icon tile over an offset backing tile (the greeting avatar's motif), a
 * small LIVE TEACHING label with the title and an optional badge, one detail
 * line, and the action on the right in the row's own tone. Only the tone,
 * copy, detail and action change, so the row keeps its height across states.
 * `alert` adds a softly breathing red dot on the icon tile for the not-yet-applied row.
 */
const FeatureCard: React.FC<{
  id: string;
  tone: FeatureTone;
  icon: React.ReactNode;
  badge?: string;
  alert?: boolean;
  title: string;
  detail: React.ReactNode;
  action: React.ReactNode;
}> = ({ id, tone, icon, badge, alert, title, detail, action }) => (
  <section className={styles.featureWrap} aria-labelledby={id}>
    <div className={styles.feature} data-tone={tone}>
      <span className={styles.art} aria-hidden="true">
        <span className={styles.artBack} />
        <span className={styles.artIcon}>{icon}</span>
        {alert && <span className={styles.alertDot} />}
      </span>
      <div className={styles.body}>
        <p className={styles.eyebrow}>
          Live teaching
          {badge && <span className={styles.badge}>{badge}</span>}
        </p>
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
        <div className={styles.detail}>{detail}</div>
      </div>
      <div className={styles.action}>{action}</div>
    </div>
  </section>
);

const Steps: React.FC<{ items: { label: string; state: "done" | "current" | "todo" }[] }> = ({ items }) => (
  <ol className={styles.steps} aria-label="Application progress">
    {items.map((item) => (
      <li key={item.label} className={styles.step} data-state={item.state}>
        <span className={styles.stepDot} aria-hidden="true">
          {item.state === "done" && <Check size={10} strokeWidth={3.5} />}
        </span>
        {item.label}
        <span className={styles.srOnly}>{item.state === "done" ? ", done" : item.state === "current" ? ", now" : ""}</span>
      </li>
    ))}
  </ol>
);

/*
 * The dashboard's live teaching block, driven by the real application status.
 * Owners who have not applied get the invitation; pending and needs-changes
 * teachers get the same card in their state's colours. Approved teachers see
 * their upcoming 1:1 sessions, or nothing here when none are booked: the
 * header chip already says live teaching is on. Nothing renders while the
 * status loads, so the dashboard never jumps.
 */
export const TeacherOverviewLiveTeaching: React.FC<{ isOwner: boolean }> = ({ isOwner }) => {
  const { data: live } = useLiveTeachingStatusPeek(true);
  if (!live) return null;

  if (live.status === "approved") return <ApprovedSessions />;

  if (live.status === "pending") {
    return (
      <FeatureCard
        id="ov-live-pending"
        tone="lavender"
        icon={<Hourglass size={18} />}
        badge="Pending"
        title="Application under review"
        detail={
          <Steps
            items={[
              { label: live.appliedAt ? `Submitted ${formatDay(live.appliedAt)}` : "Submitted", state: "done" },
              { label: "In review", state: "current" },
              { label: "Decision", state: "todo" },
            ]}
          />
        }
        action={
          <Link to="/teacher/mentorship?step=review" className={styles.ctaQuiet}>
            View application
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        }
      />
    );
  }

  if (live.status === "rejected" || live.status === "revoked") {
    const revoked = live.status === "revoked";
    return (
      <FeatureCard
        id="ov-live-changes"
        tone="butter"
        icon={<AlertTriangle size={18} />}
        badge={revoked ? "Paused" : "Changes needed"}
        title={revoked ? "Live teaching is paused" : "A few changes, then send it again"}
        detail={
          <span className={styles.meta}>
            <span className={styles.metaClamp}>
              {live.decisionReason ?? "Read the team's feedback, update your application and send it again."}
            </span>
            {live.decidedAt && (
              <>
                <span className={styles.metaSep} aria-hidden="true" />
                <span className={styles.metaSoft}>Reviewed {formatDay(live.decidedAt)}</span>
              </>
            )}
          </span>
        }
        action={
          <Link to="/teacher/mentorship" className={isOwner ? styles.cta : styles.ctaQuiet}>
            {isOwner ? "Update application" : "View feedback"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        }
      />
    );
  }

  if (!isOwner) return null;

  const started = live.checklist.some((item) => item.done && item.key !== "email" && item.key !== "phone");
  return (
    <FeatureCard
      id="ov-live-apply"
      tone="blue"
      icon={<Video size={18} />}
      alert
      title="Teach 1:1 classes live on Testkart"
      detail={
        <span className={styles.meta}>
          Set your own prices
          <span className={styles.metaSep} aria-hidden="true" />
          Teach on your schedule
          {!started && (
            <>
              <span className={styles.metaSep} aria-hidden="true" />
              <span className={styles.metaSoft}>About 10 min to apply</span>
            </>
          )}
        </span>
      }
      action={
        <Link to={`/teacher/mentorship?step=${firstOpenStep(live.checklist)}`} className={styles.cta}>
          {started ? "Continue application" : "Apply now"}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      }
    />
  );
};

const ApprovedSessions: React.FC = () => {
  const bookingsQuery = useMentorshipBookingsQuery("upcoming");
  if (!bookingsQuery.data) return null;

  const upcoming = [...bookingsQuery.data.bookings]
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return upcoming.length > 0 ? <UpcomingSessions upcoming={upcoming} /> : null;
};

const UpcomingSessions: React.FC<{ upcoming: MentorshipBookingRow[] }> = ({ upcoming }) => {
  const [nextSession, ...others] = upcoming;
  const when = timing(nextSession);

  return (
    <section className={styles.sessions} aria-labelledby="ov-live-upcoming">
      <div className={styles.sessionsHead}>
        <h2 className={styles.sessionsTitle} id="ov-live-upcoming">
          Upcoming 1:1 sessions
        </h2>
        <span className={styles.sessionsCount}>{upcoming.length} booked</span>
        <Link to="/teacher/mentorship/bookings" className={styles.sessionsLink}>
          Manage schedule
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.next}>
        <span className={styles.nextLabel}>Next session</span>
        <div className={styles.nextBody}>
          <Avatar name={nextSession.studentName} url={nextSession.studentAvatarUrl} large />
          <div className={styles.nextText}>
            <p className={styles.nextName}>{nextSession.studentName}</p>
            <p className={styles.nextMeta}>
              <span>
                <CalendarClock size={14} aria-hidden="true" />
                {dayLabel(nextSession.scheduledAt)}, {timeLabel(nextSession.scheduledAt)}
              </span>
              <span>
                <Clock size={14} aria-hidden="true" />
                {nextSession.durationMinutes} min
              </span>
              <span className={styles.kind} data-kind={nextSession.kind}>
                {KIND_LABEL[nextSession.kind]}
              </span>
            </p>
          </div>
          <StatusPill tone={when.tone} className={styles.nextStatus}>
            {when.label}
          </StatusPill>
          <Button size="sm" asChild className={styles.nextAction}>
            <Link to="/teacher/mentorship/bookings">View booking</Link>
          </Button>
        </div>
      </div>

      {others.length > 0 && (
        <ul className={styles.list}>
          {others.slice(0, OTHERS_SHOWN).map((b) => (
            <li key={b.id}>
              <Avatar name={b.studentName} url={b.studentAvatarUrl} />
              <span className={styles.rowName}>{b.studentName}</span>
              <span className={styles.rowKind}>{KIND_LABEL[b.kind]}</span>
              <span className={styles.rowWhen}>
                {dayLabel(b.scheduledAt)}, {timeLabel(b.scheduledAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {others.length > OTHERS_SHOWN && (
        <p className={styles.more}>
          And {others.length - OTHERS_SHOWN} more.{" "}
          <Link to="/teacher/mentorship/bookings" className={styles.moreLink}>
            See all bookings
          </Link>
        </p>
      )}
    </section>
  );
};
