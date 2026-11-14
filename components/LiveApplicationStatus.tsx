import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardList,
  Hourglass,
  IndianRupee,
  Mail,
  MessageSquareQuote,
  PauseCircle,
  Search,
  Send,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { StatusPill } from "./LiveField";
import { SampleIntroVideo } from "./LiveIntroVideo";
import { useWithdrawLiveTeachingMutation } from "../helpers/useLiveTeaching";
import { formatDay, type LiveApplyStep } from "../helpers/liveTeachingForms";
import type { OutputType as LiveStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import styles from "./LiveApplicationStatus.module.css";

type Props = { live: LiveStatus; onOpen: (step?: LiveApplyStep) => void };

const BENEFITS = [
  {
    tone: "mint",
    icon: <IndianRupee size={18} />,
    title: "Your price, your hours",
    text: "Set a short and a full session price and open only the hours that suit you.",
  },
  {
    tone: "lavender",
    icon: <CalendarCheck size={18} />,
    title: "Steady weekly students",
    text: "Students start with a trial, then book 1 to 6 classes a week, paid every 4 weeks.",
  },
  {
    tone: "butter",
    icon: <Search size={18} />,
    title: "Found where students look",
    text: "Your card shows in the tutor list and a Learn live section opens on your profile.",
  },
] as const;

const SHOW_PLACES = [
  {
    icon: <UserRound size={16} />,
    title: "Your public profile",
    text: "A Learn live section with your intro video, 1:1 prices and a button to see your open times.",
  },
  {
    icon: <Search size={16} />,
    title: "Tutor list",
    text: "Students looking for a 1:1 tutor see your card and can book a trial session.",
  },
  {
    icon: <Users size={16} />,
    title: "Group classes",
    text: "Live courses you create show on your profile and in the live classes list.",
  },
];

const ChecklistSummary: React.FC<{ live: LiveStatus }> = ({ live }) => (
  <ul className={styles.checklist}>
    {live.checklist.map((item) => (
      <li key={item.key} className={styles.checkItem} data-done={item.done || undefined}>
        {item.done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
        <span>{item.label}</span>
        <span className={styles.srOnly}>{item.done ? "done" : "to do"}</span>
      </li>
    ))}
  </ul>
);

/* Not applied yet, or withdrawn: what live teaching gives, how applying works, and the way in. */
export const LiveApplyLanding: React.FC<Props> = ({ live, onOpen }) => {
  const doneCount = live.checklist.filter((item) => item.done).length;
  const total = live.checklist.length;
  const started = doneCount > 0;

  return (
    <div className={styles.stack}>
      {live.withdrawnAt && (
        <div className={styles.notice} data-tone="blue" role="status">
          <Hourglass size={18} aria-hidden="true" />
          <div>
            <p className={styles.noticeTitle}>You withdrew your application on {formatDay(live.withdrawnAt)}</p>
            <p className={styles.noticeText}>Everything you entered is saved. Apply again whenever you are ready.</p>
          </div>
        </div>
      )}

      <section className={styles.hero} aria-labelledby="live-hero-title">
        <span className={styles.heroIcon} aria-hidden="true">
          <Video size={22} />
        </span>
        <div className={styles.heroText}>
          <div className={styles.heroTitleRow}>
            <h2 className={styles.heroTitle} id="live-hero-title">
              Start teaching live on Testkart
            </h2>
            <StatusPill tone="neutral">Not applied yet</StatusPill>
          </div>
          <p className={styles.heroLead}>
            Offer 1:1 sessions and live classes to students who already know your tests and notes. Our team reviews
            your application before students can book you.
          </p>
        </div>
        <div className={styles.heroActions}>
          {live.isOwner ? (
            <Button onClick={() => onOpen()}>
              {started ? "Continue application" : "Start application"}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <p className={styles.ownerNote}>Only the academy owner can apply.</p>
          )}
          {started ? (
            <span className={styles.heroProgress}>
              <span className={styles.heroTrack} aria-hidden="true">
                <span className={styles.heroFill} style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
              </span>
              {doneCount} of {total} ready
            </span>
          ) : (
            <span className={styles.heroMeta}>About 10 minutes, saved as you go</span>
          )}
        </div>
      </section>

      <ul className={styles.benefits}>
        {BENEFITS.map((b) => (
          <li key={b.title} className={styles.benefit} data-tone={b.tone}>
            <span className={styles.benefitIcon} aria-hidden="true">
              {b.icon}
            </span>
            <span className={styles.benefitTitle}>{b.title}</span>
            <span className={styles.benefitText}>{b.text}</span>
          </li>
        ))}
      </ul>

      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="live-how-title">
          <h3 className={styles.cardTitle} id="live-how-title">
            How it works
          </h3>
          <ol className={styles.steps}>
            <li className={styles.stepItem}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepText}>
                <span className={styles.stepTitle}>Apply in six short steps</span>
                <span className={styles.stepHint}>Contact details, profile, prices, weekly hours and an intro video.</span>
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepText}>
                <span className={styles.stepTitle}>The Testkart team reviews it</span>
                <span className={styles.stepHint}>Usually within a few working days. We email you the result.</span>
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepText}>
                <span className={styles.stepTitle}>Go live</span>
                <span className={styles.stepHint}>Turn on 1:1 bookings in Live settings and students can book you.</span>
              </span>
            </li>
          </ol>

          <h3 className={styles.cardTitle}>What you need</h3>
          <ChecklistSummary live={live} />
        </section>

        <section className={styles.card} aria-labelledby="live-where-title">
          <h3 className={styles.cardTitle} id="live-where-title">
            Where students will see you
          </h3>
          <ul className={styles.places}>
            {SHOW_PLACES.map((place) => (
              <li key={place.title} className={styles.place}>
                <span className={styles.placeIcon} aria-hidden="true">
                  {place.icon}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{place.title}</span>
                  <span className={styles.stepHint}>{place.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <SampleIntroVideo caption="A sample intro video, as it plays at the top of the Learn live section." />
        </section>
      </div>
    </div>
  );
};

/* Submitted and in review. */
export const LiveApplicationPending: React.FC<Props> = ({ live, onOpen }) => {
  const withdraw = useWithdrawLiveTeachingMutation();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  return (
    <div className={styles.stack}>
      <section className={`${styles.statusCard} ${styles.statusPending}`} aria-labelledby="live-pending-title">
        <div className={styles.statusHead}>
          <span className={styles.statusIcon} data-tone="butter" aria-hidden="true">
            <Hourglass size={24} />
          </span>
          <div className={styles.statusHeadText}>
            <StatusPill tone="butter">Pending approval</StatusPill>
            <h2 className={styles.statusTitle} id="live-pending-title">
              Application submitted
            </h2>
            <p className={styles.statusText}>
              Sent on {formatDay(live.appliedAt)}. The Testkart team is reviewing your profile, prices, hours and intro
              video. We will email you as soon as there is a decision.
            </p>
          </div>
        </div>

        <ol className={styles.timeline} aria-label="Application progress">
          <li className={styles.timelineItem} data-state="done">
            <span className={styles.timelineDot} aria-hidden="true">
              <CheckCircle2 size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Submitted</span>
              <span className={styles.stepHint}>{formatDay(live.appliedAt)}</span>
            </span>
          </li>
          <li className={styles.timelineItem} data-state="current">
            <span className={styles.timelineDot} aria-hidden="true">
              <ClipboardList size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Under review</span>
              <span className={styles.stepHint}>Usually a few working days</span>
            </span>
          </li>
          <li className={styles.timelineItem} data-state="todo">
            <span className={styles.timelineDot} aria-hidden="true">
              <Mail size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Decision by email</span>
              <span className={styles.stepHint}>Approved, or what to change</span>
            </span>
          </li>
          <li className={styles.timelineItem} data-state="todo">
            <span className={styles.timelineDot} aria-hidden="true">
              <Video size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Go live</span>
              <span className={styles.stepHint}>Turn on 1:1 bookings in Live settings</span>
            </span>
          </li>
        </ol>

        <div className={styles.statusActions}>
          <Button onClick={() => onOpen("review")}>
            View your application
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          {live.isOwner && (
            <Button variant="outline" onClick={() => setConfirmWithdraw(true)} disabled={withdraw.isPending}>
              Withdraw application
            </Button>
          )}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="live-wait-title">
        <h3 className={styles.cardTitle} id="live-wait-title">
          While you wait
        </h3>
        <ul className={styles.places}>
          <li className={styles.place}>
            <span className={styles.placeIcon} aria-hidden="true">
              <IndianRupee size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Prices, hours and video can still change</span>
              <span className={styles.stepHint}>Changes you save update the application in review.</span>
            </span>
          </li>
          <li className={styles.place}>
            <span className={styles.placeIcon} aria-hidden="true">
              <UserRound size={16} />
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>Polish your public profile</span>
              <span className={styles.stepHint}>
                Links, awards and work experience help students choose you.{" "}
                <Link to="/teacher/edit-profile" className={styles.inlineLink}>
                  Edit profile
                </Link>
              </span>
            </span>
          </li>
        </ul>
      </section>

      <ConsoleConfirmDialog
        open={confirmWithdraw}
        onOpenChange={setConfirmWithdraw}
        title="Withdraw your application?"
        description="It leaves the review queue. Your profile, prices, hours and video stay saved, and you can apply again any time."
        tone="destructive"
        confirmLabel="Withdraw"
        pendingLabel="Withdrawing..."
        isPending={withdraw.isPending}
        onConfirm={() =>
          withdraw.mutate(
            { what: "application" },
            {
              onSuccess: () => {
                setConfirmWithdraw(false);
                toast.success("Application withdrawn. You can apply again any time.");
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not withdraw the application."),
            }
          )
        }
      />
    </div>
  );
};

/* Rejected, or approved and later paused by the team. */
export const LiveApplicationDecision: React.FC<Props & { resumeStep: LiveApplyStep }> = ({
  live,
  onOpen,
  resumeStep,
}) => {
  const revoked = live.status === "revoked";
  return (
    <div className={styles.stack}>
      <section className={`${styles.statusCard} ${styles.statusChanges}`} aria-labelledby="live-decision-title">
        <div className={styles.statusHead}>
          <span className={styles.statusIcon} data-tone="peach" aria-hidden="true">
            {revoked ? <PauseCircle size={24} /> : <AlertTriangle size={24} />}
          </span>
          <div className={styles.statusHeadText}>
            <StatusPill tone="peach">{revoked ? "Live teaching paused" : "Changes needed"}</StatusPill>
            <h2 className={styles.statusTitle} id="live-decision-title">
              {revoked ? "Your live teaching is paused" : "Your application needs a few changes"}
            </h2>
            <p className={styles.statusText}>
              {live.decidedAt ? `Reviewed on ${formatDay(live.decidedAt)}. ` : ""}
              {revoked
                ? "Students cannot book you right now. Fix what the team asked for and apply again."
                : "Update the parts below and send it again. Everything you entered is still saved."}
            </p>
          </div>
        </div>

        {live.decisionReason && (
          <blockquote className={styles.feedback}>
            <span className={styles.feedbackLabel}>
              <MessageSquareQuote size={16} aria-hidden="true" />
              Feedback from the Testkart team
            </span>
            <p className={styles.feedbackText}>{live.decisionReason}</p>
          </blockquote>
        )}

        <ChecklistSummary live={live} />

        <div className={styles.statusActions}>
          {live.isOwner ? (
            <Button onClick={() => onOpen(resumeStep)}>
              <Send size={16} aria-hidden="true" />
              Update and resubmit
            </Button>
          ) : (
            <p className={styles.ownerNote}>Only the academy owner can resubmit the application.</p>
          )}
        </div>
      </section>
    </div>
  );
};
