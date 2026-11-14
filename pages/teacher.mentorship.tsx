import React, { useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useLiveTeachingStatusQuery } from "../helpers/useLiveTeaching";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { LiveApplyWizard } from "../components/LiveApplyWizard";
import { firstOpenStep, isLiveApplyStep, type LiveApplyStep } from "../helpers/liveTeachingForms";
import {
  LiveApplyLanding,
  LiveApplicationDecision,
  LiveApplicationPending,
} from "../components/LiveApplicationStatus";
import { LiveSettingsView } from "../components/LiveSettingsView";
import styles from "./teacher.mentorship.module.css";

/*
 * One route for the whole live teaching journey. Until approval it is the
 * Application: a landing, the step-by-step form (?step=), then the submitted
 * or needs-changes screen. Once approved the same route is Live settings, and
 * the sidebar renames itself to match.
 */
const TeacherMentorshipPage: React.FC = () => {
  const statusQuery = useLiveTeachingStatusQuery();
  const live = statusQuery.data;
  const [params, setParams] = useSearchParams();
  const stepParam = params.get("step");
  const step = isLiveApplyStep(stepParam) ? stepParam : null;
  const approved = live?.status === "approved";

  const setStep = (next: LiveApplyStep | null, replace = false) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next) out.set("step", next);
        else out.delete("step");
        return out;
      },
      { replace }
    );

  // A successful submit moves the status to pending; show the submitted screen, not the form.
  const lastStatus = useRef(live?.status);
  useEffect(() => {
    const prev = lastStatus.current;
    lastStatus.current = live?.status;
    if (prev && prev !== "pending" && live?.status === "pending" && step) setStep(null, true);
  }, [live?.status]);

  const inApplication = !approved && !!step && !!live;
  const title = approved ? "Live settings" : "Application";

  return (
    <>
      <Helmet>
        <title>{`${approved ? "Live settings" : "Live teaching application"} - Testkart`}</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        {!inApplication && (
          <ConsolePageHeader
            className={styles.header}
            title={title}
            description={
              approved
                ? "Your 1:1 bookings, prices, weekly hours and intro video in one place."
                : "Apply to teach live on Testkart: 1:1 sessions and live classes."
            }
          />
        )}

        {statusQuery.isError ? (
          <section className={styles.errorCard} role="alert">
            <p className={styles.errorText}>Could not load your live teaching status.</p>
            <Button variant="outline" onClick={() => statusQuery.refetch()}>
              Try again
            </Button>
          </section>
        ) : !live ? (
          <Skeleton style={{ height: "22rem", width: "100%", borderRadius: "1.5rem" }} />
        ) : approved ? (
          <LiveSettingsView live={live} />
        ) : step ? (
          <LiveApplyWizard live={live} step={step} onStep={(s) => setStep(s)} onExit={() => setStep(null)} />
        ) : live.status === "pending" ? (
          <LiveApplicationPending live={live} onOpen={(s) => setStep(s ?? "review")} />
        ) : live.status === "rejected" || live.status === "revoked" ? (
          <LiveApplicationDecision
            live={live}
            resumeStep={firstOpenStep(live.checklist)}
            onOpen={(s) => setStep(s ?? firstOpenStep(live.checklist))}
          />
        ) : (
          <LiveApplyLanding live={live} onOpen={(s) => setStep(s ?? firstOpenStep(live.checklist))} />
        )}
      </div>
    </>
  );
};

export default TeacherMentorshipPage;
