import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./Sheet";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { useAutopilotJourney } from "../helpers/useAdminAutopilot";
import type { JourneyEnrolment, JourneyEventKind } from "../helpers/autopilotJourneyData";
import styles from "./AutopilotJourney.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const when = (value: Date | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const KIND_TONE: Record<JourneyEventKind, string> = {
  joined: styles.dotNeutral,
  sent: styles.dotInfo,
  delivered: styles.dotInfo,
  read: styles.dotPrimary,
  clicked: styles.dotPrimary,
  replied: styles.dotPrimary,
  offer: styles.dotWarning,
  order: styles.dotSuccess,
  finished: styles.dotNeutral,
  failed: styles.dotError,
  skipped: styles.dotWarning,
  rescued: styles.dotWarning,
};

function Progress({ enrolment }: { enrolment: JourneyEnrolment }) {
  const done = enrolment.state === "active" ? Math.max(0, (enrolment.nextStep ?? 1) - 1) : enrolment.steps;
  return (
    <div className={styles.progress} aria-label={`${done} of ${enrolment.steps} messages`}>
      {Array.from({ length: enrolment.steps }).map((_, index) => (
        <span key={index} className={`${styles.pip} ${index < done ? styles.pipDone : ""}`} />
      ))}
    </div>
  );
}

function EnrolmentState({ enrolment }: { enrolment: JourneyEnrolment }) {
  if (enrolment.heldOut) return <Badge variant="secondary">Held out</Badge>;
  if (enrolment.state === "converted") return <Badge variant="success">Goal reached</Badge>;
  if (enrolment.state === "active") return <Badge variant="default">Active</Badge>;
  return <Badge variant="outline">{enrolment.exitReason ? enrolment.exitReason.replace(/_/g, " ") : "Finished"}</Badge>;
}

/** Side panel with one student's autopilot journey; opened from the Ledger. */
export function AutopilotJourney({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const journey = useAutopilotJourney(userId);
  const data = journey.data;
  return (
    <Sheet open={userId !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className={styles.sheet}>
        <SheetHeader>
          <SheetTitle>{data ? `${data.name ?? "Student"} #${data.userId}` : "Student journey"}</SheetTitle>
          <SheetDescription>Everything the autopilot did for this student, newest first.</SheetDescription>
        </SheetHeader>
        {journey.error ? (
          <div className={styles.error}>{journey.error instanceof Error ? journey.error.message : "Could not load the journey"}</div>
        ) : !data ? (
          <div className={styles.body}>
            <Skeleton className={styles.skeleton} />
            <Skeleton className={styles.skeletonTall} />
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.reach}>
              <div className={styles.reachItem}>
                <span className={styles.reachLabel}>Email</span>
                <Badge variant={data.email.usable ? "success" : "destructive"}>{data.email.note}</Badge>
              </div>
              <div className={styles.reachItem}>
                <span className={styles.reachLabel}>WhatsApp</span>
                <Badge variant={data.whatsapp.usable ? "success" : "destructive"}>{data.whatsapp.note}</Badge>
              </div>
            </div>

            <section>
              <h3 className={styles.sectionTitle}>Playbooks</h3>
              {data.enrolments.length === 0 ? (
                <p className={styles.muted}>Not in any playbook yet.</p>
              ) : (
                <ul className={styles.enrolments}>
                  {data.enrolments.map((e) => (
                    <li key={e.id} className={styles.enrolment}>
                      <div className={styles.enrolmentHead}>
                        <span className={styles.enrolmentName}>{e.label}</span>
                        <EnrolmentState enrolment={e} />
                      </div>
                      <Progress enrolment={e} />
                      <div className={styles.muted}>
                        Joined {when(e.triggerAt)}
                        {e.nextDueAt ? `, message ${e.nextStep} due ${when(e.nextDueAt)}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className={styles.sectionTitle}>Timeline</h3>
              {data.events.length === 0 ? (
                <p className={styles.muted}>Nothing has happened yet.</p>
              ) : (
                <ol className={styles.timeline}>
                  {data.events.map((event, index) => (
                    <li key={`${event.kind}-${index}`} className={styles.event}>
                      <span className={styles.eventTime}>{when(event.at)}</span>
                      <span className={`${styles.dot} ${KIND_TONE[event.kind]}`} aria-hidden />
                      <div className={styles.eventText}>
                        <span className={styles.eventTitle}>{event.title}</span>
                        {event.detail ? <span className={styles.muted}>{event.detail}</span> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}