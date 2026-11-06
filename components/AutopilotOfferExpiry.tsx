import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "./Input";
import { Button } from "./Button";
import { useAutopilotSettingsMutation } from "../helpers/useAdminAutopilot";
import styles from "./AutopilotOfferExpiry.module.css";

type Offer = { key: string; label: string; expiryDays: number };

/** How many days the Tcoins on each playbook's offer step last. Saved into the autopilot settings. */
export const AutopilotOfferExpiry = ({ offers }: { offers: Offer[] }) => {
  const mutation = useAutopilotSettingsMutation();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(Object.fromEntries(offers.map((offer) => [offer.key, String(offer.expiryDays)])));
  }, [offers]);

  const values = Object.fromEntries(offers.map((offer) => [offer.key, Number(draft[offer.key])]));
  const valid = offers.every((offer) => Number.isInteger(values[offer.key]) && values[offer.key] >= 1 && values[offer.key] <= 365);
  const changed = offers.some((offer) => values[offer.key] !== offer.expiryDays);

  const save = () =>
    mutation.mutate(
      { tcoinExpiryDays: values },
      {
        onSuccess: () => toast("Offer expiry saved"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
      }
    );

  return (
    <div className={styles.wrap}>
      <div className={styles.fields}>
        {offers.map((offer) => (
          <label key={offer.key} className={styles.field}>
            <span className={styles.label}>{offer.label}</span>
            <span className={styles.inputRow}>
              <Input
                type="number"
                min={1}
                max={365}
                step={1}
                value={draft[offer.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [offer.key]: e.target.value })}
                disabled={mutation.isPending}
              />
              <span className={styles.unit}>days</span>
            </span>
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        {!valid && <span className={styles.invalid}>Use whole days from 1 to 365.</span>}
        <Button size="sm" onClick={save} disabled={!valid || !changed || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};