import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Star, Wallet } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { LivePackageBuilder } from "./LivePackageBuilder";
import { LivePackageScheduler } from "./LivePackageScheduler";
import { Skeleton } from "./Skeleton";
import { useMentorshipTeacherOfferingsQuery } from "../helpers/useMentorship";
import {
  useCreditReleaseMutation,
  useLivePackagesQuery,
  usePackageCancelMutation,
  usePackagePayNowMutation,
  usePackageUpdateMutation,
} from "../helpers/useLivePackages";
import { startCashfreeCheckout } from "../helpers/cashfreeCheckout";
import { postMentorshipReview } from "../endpoints/mentorship/review_POST.schema";
import { formatClassLength, formatRupees, packagePerWeekOptions } from "../helpers/livePricing";
import type { LivePackageView, TrialFollowUp } from "../endpoints/mentorship/packages/list_GET.schema";
import styles from "./LivePackagesPanel.module.css";

const DISMISSED_KEY = "tk-live-trial-dismissed";
const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(d));

const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** The student's live class balance, trial follow-ups and packages, above their class list. */
export const LivePackagesPanel: React.FC = () => {
  const { data } = useLivePackagesQuery();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  if (!data) return null;

  const followUps = data.trialFollowUps.filter((t) => !dismissed.includes(t.bookingId));
  if (data.balance <= 0 && followUps.length === 0 && data.packages.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* per-device convenience only */
    }
  };

  return (
    <div className={styles.panel}>
      {data.balance > 0 && (
        <div className={styles.balance}>
          <Wallet size={18} aria-hidden="true" />
          <p className={styles.balanceText}>
            <strong>{formatRupees(data.balance)}</strong> live class balance. Use it for a trial or package with any teacher.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/expert">Find a tutor</Link>
          </Button>
        </div>
      )}
      {followUps.map((t) => (
        <TrialFollowUpCard key={t.bookingId} trial={t} balance={data.balance} onDismiss={() => dismiss(t.bookingId)} />
      ))}
      {data.packages.map((p) => (
        <PackageCard key={p.id} pkg={p} />
      ))}
    </div>
  );
};

const TrialFollowUpCard: React.FC<{ trial: TrialFollowUp; balance: number; onDismiss: () => void }> = ({ trial, balance, onDismiss }) => {
  const [rating, setRating] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const rate = async (value: number) => {
    setRating(value);
    try {
      await postMentorshipReview({ kind: "booking", id: trial.bookingId, rating: value });
      toast.success("Thanks for rating your trial.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your rating.");
    }
  };
  return (
    <section className={`${styles.card} ${styles.trial}`}>
      <p className={styles.eyebrow}>After your trial</p>
      <h3 className={styles.cardTitle}>How was your class with {trial.teacherName}?</h3>
      <div className={styles.stars} role="radiogroup" aria-label="Rate your trial">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={rating === v} aria-label={`${v} star${v > 1 ? "s" : ""}`} onClick={() => rate(v)}>
            <Star size={22} className={v <= rating ? styles.starOn : styles.starOff} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <Button onClick={() => setChoosing(true)}>Choose a plan</Button>
        <Button variant="outline" asChild>
          <Link to="/expert">Try another tutor</Link>
        </Button>
        <button type="button" className={styles.linkButton} onClick={onDismiss}>
          Not now
        </button>
      </div>
      {choosing && <PlanDialog trial={trial} balance={balance} onClose={() => setChoosing(false)} />}
    </section>
  );
};

/** The package builder from the booking page, opened in place. Cashfree returns to the booking page, which confirms and comes back here. */
const PlanDialog: React.FC<{ trial: TrialFollowUp; balance: number; onClose: () => void }> = ({ trial, balance, onClose }) => {
  const offerings = useMentorshipTeacherOfferingsQuery(trial.teacherId);
  const prices = offerings.data?.enabled ? offerings.data.prices : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader title={`Keep learning with ${trial.teacherName}`} description="4 weeks of classes, renewed by autopay." />
        <ConsoleDialogBody>
          {offerings.isLoading ? (
            <Skeleton style={{ height: "12rem", width: "100%" }} />
          ) : prices ? (
            <LivePackageBuilder
              teacherId={trial.teacherId}
              teacherName={trial.teacherName}
              prices={prices}
              balance={balance}
              maxClassesPerWeek={offerings.data?.maxClassesPerWeek ?? 0}
            />
          ) : (
            <p className={styles.dialogNote}>{trial.teacherName} is not taking new plans right now.</p>
          )}
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const PackageCard: React.FC<{ pkg: LivePackageView }> = ({ pkg }) => {
  const update = usePackageUpdateMutation();
  const cancel = usePackageCancelMutation();
  const release = useCreditReleaseMutation();
  const payNow = usePackagePayNowMutation();
  const [scheduling, setScheduling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const waiting = pkg.waitingCredits.length;
  const due = pkg.status === "past_due" && pkg.renewal?.status === "failed" ? pkg.renewal : null;
  const nextPerWeek = pkg.nextClassesPerWeek ?? pkg.classesPerWeek;

  const save = (input: { autoRenew?: boolean; nextClassesPerWeek?: number }, done: string) =>
    update.mutate(
      { packageId: pkg.id, ...input },
      { onSuccess: () => toast.success(done), onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save.") }
    );

  const pay = async () => {
    try {
      const result = await payNow.mutateAsync({ packageId: pkg.id });
      if (result.kind === "completed") toast.success("Paid from your balance. Your classes are booked.");
      else await startCashfreeCheckout(result.session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        {pkg.teacher.avatarUrl ? (
          <img src={pkg.teacher.avatarUrl} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {pkg.teacher.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className={styles.headText}>
          <h3 className={styles.cardTitle}>{pkg.teacher.displayName}</h3>
          <p className={styles.meta}>
            {pkg.classesPerWeek} a week, {formatClassLength(pkg.classMinutes).toLowerCase()}, {formatRupees(pkg.pricePerClass)} a class
          </p>
        </div>
        <span className={`${styles.chip} ${due ? styles.chipDue : styles.chipActive}`}>{due ? "Payment due" : "Active"}</span>
      </div>

      {due && (
        <div className={styles.alert} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>
            Autopay did not go through{due.failureReason ? ` (${due.failureReason})` : ""}. Pay {formatRupees(due.amount)}
            {due.graceUntil ? ` by ${fmtDate(due.graceUntil)}` : ""} to keep your class times.
          </p>
          <Button size="sm" disabled={payNow.isPending} onClick={pay}>
            {payNow.isPending ? "Opening..." : "Pay now"}
          </Button>
        </div>
      )}

      <dl className={styles.stats}>
        <div>
          <dt>Booked</dt>
          <dd>{pkg.upcoming.length}</dd>
        </div>
        <div>
          <dt>To schedule</dt>
          <dd>{waiting}</dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd>{pkg.heldCount}</dd>
        </div>
        <div>
          <dt>{pkg.autoRenew ? "Renews" : "Ends"}</dt>
          <dd>{pkg.cycle ? fmtDate(pkg.cycle.endsAt) : "-"}</dd>
        </div>
      </dl>

      {waiting > 0 && (
        <div className={styles.waiting}>
          <p>
            {waiting} paid class{waiting > 1 ? "es need" : " needs"} a time.
          </p>
          <div className={styles.actions}>
            <Button size="sm" onClick={() => setScheduling(true)}>
              <CalendarPlus size={14} aria-hidden="true" /> Pick times
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={release.isPending}
              onClick={() =>
                release.mutate(
                  { creditId: pkg.waitingCredits[0].id },
                  {
                    onSuccess: (r) => toast.success(`${formatRupees(r.released)} moved to your live class balance.`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not move this class."),
                  }
                )
              }
            >
              Move one to balance
            </Button>
          </div>
        </div>
      )}

      <div className={styles.settings}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={pkg.autoRenew} disabled={update.isPending} onChange={(e) => save({ autoRenew: e.target.checked }, e.target.checked ? "Autopay renewal is on." : "Autopay renewal is off.")} />
          Renew by autopay
        </label>
        <label className={styles.select}>
          Next 4 weeks
          <select
            value={nextPerWeek}
            disabled={update.isPending || !pkg.autoRenew}
            onChange={(e) => save({ nextClassesPerWeek: Number(e.target.value) }, "Saved for your next 4 weeks.")}
          >
            {packagePerWeekOptions(pkg.maxClassesPerWeek).map((n) => (
              <option key={n} value={n}>
                {n} a week
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.linkButton} onClick={() => setConfirmCancel(true)}>
          Cancel package
        </button>
      </div>

      {scheduling && waiting > 0 && <ScheduleDialog pkg={pkg} onClose={() => setScheduling(false)} />}

      <ConsoleConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel your package with ${pkg.teacher.displayName}?`}
        description="Classes more than 6 hours away are cancelled and their money goes to your live class balance, to use with any teacher. Classes within 6 hours still go ahead. Autopay stops."
        tone="destructive"
        confirmLabel="Cancel package"
        pendingLabel="Cancelling..."
        isPending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(
            { packageId: pkg.id },
            {
              onSuccess: (r) => {
                setConfirmCancel(false);
                toast.success(r.released > 0 ? `Package cancelled. ${formatRupees(r.released)} is in your live class balance.` : "Package cancelled.");
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel the package."),
            }
          )
        }
      />
    </section>
  );
};

const ScheduleDialog: React.FC<{ pkg: LivePackageView; onClose: () => void }> = ({ pkg, onClose }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <ConsoleDialogContent size="lg">
      <ConsoleDialogHeader title={`Classes with ${pkg.teacher.displayName}`} description={`${formatClassLength(pkg.classMinutes)}, already paid.`} />
      <ConsoleDialogBody>
        <LivePackageScheduler pkg={pkg} onDone={(left) => left === 0 && onClose()} />
      </ConsoleDialogBody>
    </ConsoleDialogContent>
  </Dialog>
);
