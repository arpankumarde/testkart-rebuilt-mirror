import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminTcoinGrants, useAdminTcoinsSettings, useGrantAdminTcoins } from "../helpers/useTcoins";
import { Input } from "./Input";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import styles from "./AdminTcoinGrants.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in India time, the format a date input reads. */
const indiaDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);

const ddmmyyyy = (date: Date) => {
  const [y, m, d] = indiaDate(new Date(date)).split("-");
  return `${d}-${m}-${y}`;
};

/** Give one student coins with their own expiry date, and the latest grants (admin and autopilot). */
export const AdminTcoinGrants = ({ className }: { className?: string }) => {
  const { data: settings } = useAdminTcoinsSettings();
  const { data, isLoading, isError, error } = useAdminTcoinGrants();
  const { mutate: grant, isPending } = useGrantAdminTcoins();

  const [student, setStudent] = useState("");
  const [coins, setCoins] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [reason, setReason] = useState("");

  const defaultDays = settings?.expiryDays ?? 30;
  useEffect(() => {
    if (!expiresOn) setExpiresOn(indiaDate(new Date(Date.now() + defaultDays * DAY_MS)));
  }, [defaultDays, expiresOn]);

  const coinCount = Number(coins);
  const today = indiaDate(new Date());
  const canSubmit =
    student.trim().length >= 3 && Number.isInteger(coinCount) && coinCount >= 1 && coinCount <= 10000 && expiresOn >= today;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    grant(
      { student: student.trim(), coins: coinCount, expiresOn, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setStudent("");
          setCoins("");
          setReason("");
          setExpiresOn("");
        },
      }
    );
  };

  return (
    <section className={`${styles.container} ${className ?? ""}`} aria-labelledby="tcoin-grants-title">
      <div>
        <h2 id="tcoin-grants-title" className={styles.title}>Give coins</h2>
        <p className={styles.hint}>
          The coins are added at once and can be used until the end of the expiry day. Students spend the coins that
          expire soonest first.
        </p>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <label className={`${styles.field} ${styles.wide}`}>
          <span className={styles.fieldLabel}>Student email or mobile</span>
          <Input value={student} onChange={(e) => setStudent(e.target.value)} disabled={isPending} autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Coins</span>
          <Input type="number" min={1} max={10000} step={1} value={coins} onChange={(e) => setCoins(e.target.value)} disabled={isPending} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Expires on</span>
          <Input type="date" min={today} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} disabled={isPending} />
        </label>
        <label className={`${styles.field} ${styles.wide}`}>
          <span className={styles.fieldLabel}>Reason (only admins see it)</span>
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} disabled={isPending} />
        </label>
        <div className={styles.actions}>
          <Button type="submit" disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className={styles.spinner} size={16} />}
            {isPending ? "Giving..." : "Give coins"}
          </Button>
        </div>
      </form>

      <div className={styles.results}>
        <h3 className={styles.subtitle}>Latest grants</h3>
        {isLoading ? (
          <Skeleton className={styles.loading} />
        ) : isError ? (
          <p className={styles.hint} role="alert">{error?.message || "Could not load grants."}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Given</th>
                <th>Student</th>
                <th className={styles.numeric}>Coins</th>
                <th>Expires</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {data && data.grants.length > 0 ? (
                data.grants.map((g) => {
                  const expired = new Date(g.expiresAt).getTime() <= Date.now();
                  return (
                    <tr key={g.id}>
                      <td className={styles.nowrap}>{ddmmyyyy(g.createdAt)}</td>
                      <td>
                        {g.studentName || "-"}
                        {g.studentEmail && <span className={styles.sub}>{g.studentEmail}</span>}
                      </td>
                      <td className={styles.numeric}>{g.coins}</td>
                      <td className={styles.nowrap}>
                        {ddmmyyyy(g.expiresAt)}
                        {expired && <span className={styles.expired}>Expired</span>}
                      </td>
                      <td>{g.reason || "-"}</td>
                      <td>{g.grantedBy || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className={styles.empty}>No coins given yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};