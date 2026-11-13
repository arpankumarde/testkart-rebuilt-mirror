import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Repeat, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { LiveSlotPicker, localDayKey, useLiveSlotRange, useOpenSlotTimes } from "./LiveSlotPicker";
import { usePackageCheckoutMutation } from "../helpers/useLivePackages";
import { startCashfreeSubscriptionCheckout } from "../helpers/cashfreeCheckout";
import {
  classPriceFor,
  formatRupees,
  LivePrices,
  LiveClassMinutes,
  PACKAGE_CLASSES_PER_WEEK_OPTIONS,
  packageClassCount,
  packageMandateMax,
} from "../helpers/livePricing";
import { MENTORSHIP_SESSION_DURATIONS, PACKAGE_CYCLE_DAYS } from "../helpers/liveLessonConfig";
import styles from "./LivePackageBuilder.module.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Pick classes per week and length, pick the 4 weeks of times, then set up autopay and pay. */
export const LivePackageBuilder: React.FC<{
  teacherId: number;
  teacherName: string;
  prices: LivePrices;
  balance: number;
}> = ({ teacherId, teacherName, prices, balance }) => {
  const [perWeek, setPerWeek] = useState(2);
  const [minutes, setMinutes] = useState<LiveClassMinutes>(MENTORSHIP_SESSION_DURATIONS[MENTORSHIP_SESSION_DURATIONS.length - 1]);
  const [repeat, setRepeat] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const range = useLiveSlotRange(PACKAGE_CYCLE_DAYS);
  const openTimes = useOpenSlotTimes(teacherId, minutes, range);
  const checkout = usePackageCheckoutMutation();

  const count = packageClassCount(perWeek);
  const price = classPriceFor(prices, minutes);
  const total = price * count;
  const fromBalance = Math.min(Math.max(balance, 0), total);
  const toPay = total - fromBalance;
  const remaining = count - selected.length;

  const pickedDays = useMemo(() => new Set(selected.map((ms) => localDayKey(new Date(ms)))), [selected]);

  const choosePerWeek = (n: number) => {
    setPerWeek(n);
    setSelected((s) => s.slice(0, packageClassCount(n)));
  };
  const chooseMinutes = (m: LiveClassMinutes) => {
    setMinutes(m);
    setSelected([]);
  };

  const onPick = (next: number[]) => {
    const added = next.find((ms) => !selected.includes(ms));
    if (!repeat || added === undefined) return setSelected(next);
    const filled = [...selected];
    const days = new Set(pickedDays);
    for (let week = 0; week < 4 && filled.length < count; week++) {
      const ms = added + week * WEEK_MS;
      const key = localDayKey(new Date(ms));
      if (!openTimes.has(ms) || days.has(key) || filled.includes(ms)) continue;
      filled.push(ms);
      days.add(key);
    }
    setSelected(filled.sort((a, b) => a - b));
  };

  const pay = async () => {
    try {
      const session = await checkout.mutateAsync({
        teacherId,
        classesPerWeek: perWeek,
        classMinutes: minutes,
        startTimes: selected.map((ms) => new Date(ms)),
      });
      await startCashfreeSubscriptionCheckout(session);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  return (
    <div className={styles.builder}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Classes a week</h2>
        <div className={styles.chips} role="radiogroup" aria-label="Classes a week">
          {PACKAGE_CLASSES_PER_WEEK_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={perWeek === n}
              className={`${styles.chip} ${perWeek === n ? styles.chipOn : ""}`}
              onClick={() => choosePerWeek(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <h2 className={styles.cardTitle}>Class length</h2>
        <div className={styles.lengths} role="radiogroup" aria-label="Class length">
          {MENTORSHIP_SESSION_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              className={`${styles.length} ${minutes === m ? styles.lengthOn : ""}`}
              onClick={() => chooseMinutes(m)}
            >
              <span>{m} min</span>
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

      <div className={styles.pickHead}>
        <p className={styles.counter} aria-live="polite">
          {remaining > 0 ? `Pick ${remaining} more time${remaining > 1 ? "s" : ""}` : "All times picked"}
          <span className={styles.counterSub}>
            {selected.length} of {count}
          </span>
        </p>
        <label className={styles.repeat}>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <Repeat size={14} aria-hidden="true" /> Same time every week
        </label>
      </div>

      <LiveSlotPicker
        teacherId={teacherId}
        minutes={minutes}
        range={range}
        mode="multi"
        selected={selected}
        onChange={onPick}
        maxSelected={count}
        title={`Times with ${teacherName}`}
        emptyText="This teacher has no open times in the next 4 weeks."
      />

      <div className={styles.cta}>
        <Button size="lg" disabled={remaining > 0 || checkout.isPending} onClick={pay}>
          {checkout.isPending ? "Opening payment..." : toPay > 0 ? `Set up autopay and pay ${formatRupees(toPay)}` : "Set up autopay and book"}
        </Button>
        <p className={styles.small}>
          <ShieldCheck size={14} aria-hidden="true" /> Cancel or move a class up to 6 hours before. Cancelled classes stay in your
          package or go to your live class balance.
        </p>
      </div>
    </div>
  );
};
