import React, { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { useSaveSpinProbabilities } from "../helpers/useSpinWinAdmin";
import { discountLabel, probabilityProblems, toMilli } from "../helpers/spinWinRules";
import type { AdminSpinCampaign, AdminSpinReward } from "../helpers/spinWinAdmin";
import styles from "./SpinWinProbabilityDialog.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: AdminSpinCampaign;
  rewards: AdminSpinReward[];
};

type Row = { id: number; name: string; detail: string; color: string; probability: string; isActive: boolean };

const toRows = (rewards: AdminSpinReward[]): Row[] =>
  rewards.map((r) => ({
    id: r.id,
    name: r.name,
    detail: discountLabel(r.discountType, r.discountValue),
    color: r.segmentColor,
    probability: String(r.probability),
    isActive: r.isActive,
  }));

/*
 * Edits every reward's odds at once, so a live wheel moves from one valid 100% split to the
 * next in a single save. Turning the Grand Prize on for Diwali happens here.
 */
export const SpinWinProbabilityDialog: React.FC<Props> = ({ open, onOpenChange, campaign, rewards }) => {
  const [rows, setRows] = useState<Row[]>(() => toRows(rewards));
  const save = useSaveSpinProbabilities();
  const live = campaign.status === "published" || campaign.status === "paused";

  useEffect(() => {
    if (open) setRows(toRows(rewards));
  }, [open, rewards]);

  const update = (id: number, patch: Partial<Row>) => setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const parsed = rows.map((row) => ({ ...row, value: Number(row.probability || 0) }));
  const total = parsed.filter((r) => r.isActive).reduce((sum, r) => sum + toMilli(r.value), 0) / 1000;
  const problems = probabilityProblems(parsed.map((r) => ({ name: r.name, isActive: r.isActive, probability: r.value })));
  const invalidNumber = parsed.some((r) => !Number.isFinite(r.value) || r.value < 0 || r.value > 100);

  const fillRemainder = (id: number) => {
    const others = parsed.filter((r) => r.isActive && r.id !== id).reduce((sum, r) => sum + toMilli(r.value), 0);
    const rest = Math.max(0, 100000 - others) / 1000;
    update(id, { probability: String(rest), isActive: rest > 0 });
  };

  const submit = () =>
    save.mutate(
      { campaignId: campaign.id, items: parsed.map((r) => ({ id: r.id, probability: r.value, isActive: r.isActive })) },
      { onSuccess: () => onOpenChange(false) }
    );

  const blocked = invalidNumber || (live && problems.length > 0) || parsed.some((r) => r.isActive && toMilli(r.value) <= 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title="Edit probabilities"
          description={live ? "This campaign is live: the rewards that are on must add up to exactly 100%." : "Drafts can be saved at any total; publishing needs exactly 100%."}
        />
        <ConsoleDialogBody className={styles.body}>
          <ul className={styles.list}>
            {rows.map((row) => (
              <li key={row.id} className={`${styles.row} ${row.isActive ? "" : styles.off}`}>
                <span className={styles.swatch} style={{ background: row.color }} aria-hidden="true" />
                <span className={styles.name}>
                  <span className={styles.title}>{row.name}</span>
                  <span className={styles.detail}>{row.detail}</span>
                </span>
                <span className={styles.inputWrap}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.001}
                    value={row.probability}
                    aria-label={`${row.name} probability`}
                    onChange={(e) => update(row.id, { probability: e.target.value })}
                    className={styles.input}
                  />
                  <span className={styles.unit}>%</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => fillRemainder(row.id)}>
                  Fill to 100
                </Button>
                <Switch checked={row.isActive} onCheckedChange={(checked) => update(row.id, { isActive: checked })} aria-label={`${row.name} on`} />
              </li>
            ))}
          </ul>

          <div className={`${styles.total} ${total === 100 ? styles.totalOk : styles.totalOff}`} role="status">
            <span>Rewards that are on</span>
            <strong>{total}%</strong>
          </div>
          {problems.length > 0 ? (
            <ul className={styles.problems}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={blocked || save.isPending}>
            {save.isPending ? "Saving…" : "Save probabilities"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};