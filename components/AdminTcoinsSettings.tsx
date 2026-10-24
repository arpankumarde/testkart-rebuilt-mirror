import React, { useEffect, useState } from "react";
import { Coins, AlertTriangle, Loader2 } from "lucide-react";
import { useAdminTcoinsSettings, useUpdateAdminTcoinsSettings } from "../helpers/useTcoins";
import { Switch } from "./Switch";
import { Input } from "./Input";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import styles from "./AdminTcoinsSettings.module.css";

type Draft = {
  enabled: boolean;
  redeemPercent: string;
  cashbackPercent: string;
  maxCashback: string;
};

export const AdminTcoinsSettings = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, error } = useAdminTcoinsSettings();
  const { mutate: save, isPending } = useUpdateAdminTcoinsSettings();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (data) {
      setDraft({
        enabled: data.enabled,
        redeemPercent: String(data.redeemPercent),
        cashbackPercent: String(data.cashbackPercent),
        maxCashback: String(data.maxCashback),
      });
    }
  }, [data]);

  if (isLoading || (!draft && !isError)) {
    return <Skeleton className={`${styles.loading} ${className ?? ""}`} />;
  }

  if (isError || !data || !draft) {
    return (
      <div className={`${styles.container} ${className ?? ""}`}>
        <p className={styles.error} role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          {error?.message || "Could not load Tcoins settings."}
        </p>
      </div>
    );
  }

  const redeemPercent = Number(draft.redeemPercent);
  const cashbackPercent = Number(draft.cashbackPercent);
  const maxCashback = Number(draft.maxCashback);
  const isValid =
    draft.redeemPercent.trim() !== "" && Number.isFinite(redeemPercent) && redeemPercent >= 0 && redeemPercent <= 100 &&
    draft.cashbackPercent.trim() !== "" && Number.isFinite(cashbackPercent) && cashbackPercent >= 0 && cashbackPercent <= 100 &&
    draft.maxCashback.trim() !== "" && Number.isInteger(maxCashback) && maxCashback >= 0;
  const hasChanged =
    draft.enabled !== data.enabled ||
    redeemPercent !== data.redeemPercent ||
    cashbackPercent !== data.cashbackPercent ||
    maxCashback !== data.maxCashback;

  const update = (field: keyof Omit<Draft, "enabled">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [field]: e.target.value });

  const exampleCart = 400;
  const exampleCoins = Number.isFinite(redeemPercent) ? Math.floor((exampleCart * redeemPercent) / 100) : 0;
  const examplePaid = exampleCart - exampleCoins;
  const exampleCashback = Number.isFinite(cashbackPercent)
    ? Math.min(Number.isFinite(maxCashback) ? maxCashback : 0, Math.floor((examplePaid * cashbackPercent) / 100))
    : 0;

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <div className={styles.header}>
        <Coins className={styles.headerIcon} size={24} aria-hidden="true" />
        <div>
          <h2 className={styles.title}>Tcoins</h2>
          <p className={styles.description}>
            Coins students earn as cashback and spend on part of an order. They can't be withdrawn and can't be
            combined with a coupon. Testkart covers the coins spent, so teacher earnings stay on the full price.
          </p>
        </div>
      </div>

      <label className={styles.toggleRow} htmlFor="tcoins-enabled">
        <div>
          <span className={styles.toggleLabel}>Show Tcoins to students</span>
          <span className={styles.toggleHint}>
            {draft.enabled
              ? "On: students see their balance, can spend coins at checkout and earn cashback."
              : "Off: Tcoins are hidden everywhere and new orders earn no cashback."}
          </span>
        </div>
        <Switch
          id="tcoins-enabled"
          checked={draft.enabled}
          onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })}
          disabled={isPending}
        />
      </label>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Spend limit (% of order value)</span>
          <Input type="number" min={0} max={100} step="any" value={draft.redeemPercent} onChange={update("redeemPercent")} disabled={isPending} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Cashback (% of amount paid)</span>
          <Input type="number" min={0} max={100} step="any" value={draft.cashbackPercent} onChange={update("cashbackPercent")} disabled={isPending} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Most cashback per order (coins)</span>
          <Input type="number" min={0} step={1} value={draft.maxCashback} onChange={update("maxCashback")} disabled={isPending} />
        </label>
      </div>

      {isValid && (
        <p className={styles.example}>
          Example: a ₹{exampleCart} cart can use {exampleCoins} coins, so the student pays ₹{examplePaid} and earns{" "}
          {exampleCashback} coins back.
        </p>
      )}

      <dl className={styles.stats}>
        <div>
          <dt>Coins students hold</dt>
          <dd>{data.outstandingCoins.toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt>Students with coins</dt>
          <dd>{data.studentsWithCoins.toLocaleString("en-IN")}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        {!isValid && <span className={styles.invalid}>Percentages run 0 to 100 and the cap is a whole number.</span>}
        <Button
          onClick={() => save({ enabled: draft.enabled, redeemPercent, cashbackPercent, maxCashback })}
          disabled={!hasChanged || !isValid || isPending}
        >
          {isPending && <Loader2 className={styles.spinner} size={16} />}
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
};