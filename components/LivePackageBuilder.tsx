import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { usePackageCheckoutMutation } from "../helpers/useLivePackages";
import { startCashfreeSubscriptionCheckout } from "../helpers/cashfreeCheckout";
import {
  classPriceFor,
  classLengthName,
  formatRupees,
  LivePrices,
  LiveClassMinutes,
  packageClassCount,
  packageMandateMax,
  packagePerWeekOptions,
} from "../helpers/livePricing";
import { MENTORSHIP_SESSION_DURATIONS } from "../helpers/liveLessonConfig";
import styles from "./LivePackageBuilder.module.css";

/**
 * Pick classes per week and length, then set up autopay and pay. Class times are picked after
 * payment (LivePackageScheduler). Classes a week stop at the teacher's teaching weekdays.
 */
export const LivePackageBuilder: React.FC<{
  teacherId: number;
  teacherName: string;
  prices: LivePrices;
  balance: number;
  /** The teacher's teaching weekdays, at most 6 (teacher-offerings maxClassesPerWeek). */
  maxClassesPerWeek: number;
}> = ({ teacherId, teacherName, prices, balance, maxClassesPerWeek }) => {
  const options = packagePerWeekOptions(maxClassesPerWeek);
  const [perWeek, setPerWeek] = useState(Math.min(2, Math.max(1, options.length)));
  const [minutes, setMinutes] = useState<LiveClassMinutes>(MENTORSHIP_SESSION_DURATIONS[MENTORSHIP_SESSION_DURATIONS.length - 1]);
  const checkout = usePackageCheckoutMutation();

  if (options.length === 0) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>No open hours right now</h2>
        <p className={styles.muted}>{teacherName} has not set any open hours for 1:1 classes. Please check back later.</p>
      </section>
    );
  }

  const count = packageClassCount(perWeek);
  const price = classPriceFor(prices, minutes);
  const total = price * count;
  const fromBalance = Math.min(Math.max(balance, 0), total);
  const toPay = total - fromBalance;

  const pay = async () => {
    try {
      const session = await checkout.mutateAsync({ teacherId, classesPerWeek: perWeek, classMinutes: minutes });
      await startCashfreeSubscriptionCheckout(session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  return (
    <div className={styles.builder}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Classes a week</h2>
        <div className={styles.chips} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Classes a week">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={perWeek === n}
              className={`${styles.chip} ${perWeek === n ? styles.chipOn : ""}`}
              onClick={() => setPerWeek(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {options.length < 6 && (
          <p className={styles.muted}>
            {teacherName} teaches on {options.length} day{options.length > 1 ? "s" : ""} a week, one class a day.
          </p>
        )}
        <h2 className={styles.cardTitle}>Class length</h2>
        <div className={styles.lengths} role="radiogroup" aria-label="Class length">
          {MENTORSHIP_SESSION_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              className={`${styles.length} ${minutes === m ? styles.lengthOn : ""}`}
              onClick={() => setMinutes(m)}
            >
              <span className={styles.lengthLabel}>
                {classLengthName(m)}
                <span className={styles.lengthMins}>{m} min</span>
              </span>
              <span className={styles.lengthPrice}>{formatRupees(classPriceFor(prices, m))} a class</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.summary} aria-label="Price">
        <div className={styles.row}>
          <span>{count} classes over 4 weeks</span>
          <span>
            {count} x {formatRupees(price)}
          </span>
        </div>
        {fromBalance > 0 && (
          <div className={styles.row}>
            <span>From your live class balance</span>
            <span>- {formatRupees(fromBalance)}</span>
          </div>
        )}
        <div className={`${styles.row} ${styles.total}`}>
          <span>Pay now</span>
          <span>{formatRupees(toPay)}</span>
        </div>
        <p className={styles.small}>
          Renews every 4 weeks for {formatRupees(total)} by autopay, at this price. Autopay limit {formatRupees(packageMandateMax(price))}.
        </p>
      </section>

      <div className={styles.cta}>
        <Button size="lg" disabled={checkout.isPending} onClick={pay}>
          {checkout.isPending ? "Opening payment..." : toPay > 0 ? `Pay ${formatRupees(toPay)} and set up autopay` : "Set up autopay"}
        </Button>
        <p className={styles.small}>
          <CalendarCheck size={14} aria-hidden="true" /> Right after paying, pick a day and time once and we book it for all 4 weeks.
        </p>
        <p className={styles.small}>
          <ShieldCheck size={14} aria-hidden="true" /> Cancel or move a class up to 6 hours before. Cancelled classes stay in your
          package or go to your live class balance.
        </p>
      </div>
    </div>
  );
};