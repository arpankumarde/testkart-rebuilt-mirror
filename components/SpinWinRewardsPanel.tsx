import React, { useState } from "react";
import { Crown, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { SpinWinWheel } from "./SpinWinWheel";
import { SpinWinRewardDialog } from "./SpinWinRewardDialog";
import { SpinWinProbabilityDialog } from "./SpinWinProbabilityDialog";
import { useDeleteSpinReward } from "../helpers/useSpinWinAdmin";
import { adminFormat } from "../helpers/adminFormat";
import { discountLabel, formatInZone, SPIN_REWARD_TYPE_LABELS, type SpinRewardType } from "../helpers/spinWinRules";
import type { AdminSpinCampaign, AdminSpinReward } from "../helpers/spinWinAdmin";
import styles from "./SpinWinRewardsPanel.module.css";

type Props = {
  campaign: AdminSpinCampaign;
  rewards: AdminSpinReward[];
  probabilityTotal: number;
  problems: string[];
};

type Editing = { reward?: AdminSpinReward; type?: SpinRewardType } | null;

const RowActions: React.FC<{ reward: AdminSpinReward; locked: boolean; onEdit: () => void; onDelete: () => void }> = ({ reward, locked, onEdit, onDelete }) => (
  <div className={styles.actions}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${reward.name}`} onClick={onEdit} disabled={locked}>
          <Pencil size={15} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${reward.name}`} onClick={onDelete} disabled={locked || reward.spins > 0}>
          <Trash2 size={15} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{reward.spins > 0 ? "Won already: turn it off instead" : "Delete"}</TooltipContent>
    </Tooltip>
  </div>
);

const minOrder = (r: AdminSpinReward) => (r.discountType && r.minOrderValue ? adminFormat.inr(r.minOrderValue) : "None");

export const SpinWinRewardsPanel: React.FC<Props> = ({ campaign, rewards, probabilityTotal, problems }) => {
  const [editing, setEditing] = useState<Editing>(null);
  const [probabilitiesOpen, setProbabilitiesOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminSpinReward | null>(null);
  const remove = useDeleteSpinReward();
  const locked = campaign.status === "completed";

  const wheelRewards = rewards.filter((r) => r.rewardType !== "grand_prize");
  const grandPrizes = rewards.filter((r) => r.rewardType === "grand_prize");
  const active = rewards.filter((r) => r.isActive);
  const segments = active.map((r) => ({ key: r.id, label: r.wheelLabel, color: r.segmentColor }));
  const totalOk = probabilityTotal === 100;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <Button onClick={() => setEditing({ type: "percentage" })} disabled={locked}>
          <Plus size={16} /> Add reward
        </Button>
        <Button variant="outline" onClick={() => setProbabilitiesOpen(true)} disabled={locked || rewards.length === 0}>
          <Scale size={16} /> Edit probabilities
        </Button>
      </div>

      <div className={styles.layout}>
        <section className={styles.wheelCard} aria-label="Wheel preview and odds">
          <h2 className={styles.cardTitle}>Live wheel</h2>
          <SpinWinWheel segments={segments} size={300} />
          <div className={`${styles.total} ${totalOk ? styles.totalOk : styles.totalOff}`} role="status">
            <span>Active odds</span>
            <strong>{probabilityTotal}%</strong>
          </div>
          <ul className={styles.odds} aria-label="Probability distribution">
            {active.map((r) => (
              <li key={r.id} className={styles.oddsRow}>
                <span className={styles.oddsName}>
                  <span className={styles.dot} style={{ background: r.segmentColor }} aria-hidden="true" />
                  {r.name}
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span className={styles.barFill} style={{ width: `${Math.min(100, r.probability)}%` }} />
                </span>
                <span className={styles.oddsValue}>{r.probability}%</span>
              </li>
            ))}
          </ul>
          {problems.length > 0 ? (
            <ul className={styles.problems} aria-label="Before publishing">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.ready}>The wheel is valid and every spin lands on a reward.</p>
          )}
        </section>

        <section className={styles.listCard} aria-label="Rewards">
          <h2 className={styles.cardTitle}>Rewards</h2>
          {wheelRewards.length === 0 ? (
            <ConsoleListEmpty title="No rewards yet" description="Add the slices students can win.">
              <Button onClick={() => setEditing({ type: "percentage" })} disabled={locked}>
                <Plus size={16} /> Add reward
              </Button>
            </ConsoleListEmpty>
          ) : (
            <div className={styles.results}>
              <table className={styles.table}>
                <colgroup>
                  <col />
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "6rem" }} />
                  <col style={{ width: "5rem" }} />
                  <col style={{ width: "4.5rem" }} />
                  <col style={{ width: "4.5rem" }} />
                  <col style={{ width: "5rem" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Reward</th>
                    <th scope="col">Discount</th>
                    <th scope="col" className={styles.num}>Min order</th>
                    <th scope="col" className={styles.num}>Odds</th>
                    <th scope="col" className={styles.num}>Won</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {wheelRewards.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={styles.identity}>
                          <span className={styles.dot} style={{ background: r.segmentColor }} aria-hidden="true" />
                          <span className={styles.stack}>
                            <span className={styles.primary}>{r.name}</span>
                            <span className={styles.secondary}>
                              {SPIN_REWARD_TYPE_LABELS[r.rewardType]} · "{r.wheelLabel}"
                              {r.quantityLimit !== null ? ` · ${r.quantityLimit} available` : ""}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{discountLabel(r.discountType, r.discountValue)}</td>
                      <td className={`${styles.num} ${r.minOrderValue ? "" : styles.muted}`}>{minOrder(r)}</td>
                      <td className={`${styles.num} ${r.probability === 0 ? styles.muted : ""}`}>{r.probability}%</td>
                      <td className={`${styles.num} ${r.spins === 0 ? styles.muted : ""}`}>{adminFormat.count(r.spins)}</td>
                      <td>{r.isActive ? <Badge variant="success">On</Badge> : <Badge variant="outline">Off</Badge>}</td>
                      <td>
                        <RowActions reward={r} locked={locked} onEdit={() => setEditing({ reward: r })} onDelete={() => setDeleting(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className={styles.cards}>
                {wheelRewards.map((r) => (
                  <li key={r.id} className={styles.cardItem}>
                    <div className={styles.cardHead}>
                      <span className={styles.identity}>
                        <span className={styles.dot} style={{ background: r.segmentColor }} aria-hidden="true" />
                        <span className={styles.stack}>
                          <span className={styles.primary}>{r.name}</span>
                          <span className={styles.secondary}>{discountLabel(r.discountType, r.discountValue)}</span>
                        </span>
                      </span>
                      {r.isActive ? <Badge variant="success">On</Badge> : <Badge variant="outline">Off</Badge>}
                    </div>
                    <dl className={styles.facts}>
                      <div>
                        <dt>Odds</dt>
                        <dd>{r.probability}%</dd>
                      </div>
                      <div>
                        <dt>Min order</dt>
                        <dd>{minOrder(r)}</dd>
                      </div>
                      <div>
                        <dt>Won</dt>
                        <dd>{adminFormat.count(r.spins)}</dd>
                      </div>
                    </dl>
                    <RowActions reward={r} locked={locked} onEdit={() => setEditing({ reward: r })} onDelete={() => setDeleting(r)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className={styles.grandCard} aria-label="Grand Prize">
        <div className={styles.grandHead}>
          <span className={styles.grandIcon} aria-hidden="true">
            <Crown size={20} />
          </span>
          <div className={styles.stack}>
            <h2 className={styles.cardTitle}>Grand Prize</h2>
            <span className={styles.grandNote}>
              Decide the prize before turning it on. It stays off at 0% until approved; to run it, give it a small chance and rebalance the others in Edit probabilities.
            </span>
          </div>
          {grandPrizes.length === 0 ? (
            <Button variant="outline" onClick={() => setEditing({ type: "grand_prize" })} disabled={locked}>
              <Plus size={16} /> Add Grand Prize
            </Button>
          ) : null}
        </div>
        {grandPrizes.map((g) => (
          <div key={g.id} className={styles.grandRow}>
            {g.imageUrl ? <img src={g.imageUrl} alt="" className={styles.grandImage} /> : null}
            <dl className={styles.facts}>
              <div>
                <dt>Name</dt>
                <dd>{g.name}</dd>
              </div>
              <div>
                <dt>Benefit</dt>
                <dd>{g.discountType ? discountLabel(g.discountType, g.discountValue) : "To be decided"}</dd>
              </div>
              <div>
                <dt>Odds</dt>
                <dd>{g.probability}%</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{g.quantityLimit === null ? "Unlimited" : g.quantityLimit}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>{g.activatesAt ? formatInZone(g.activatesAt, campaign.timezone) : "Any time"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{g.isActive ? <Badge variant="success">On</Badge> : <Badge variant="outline">Off</Badge>}</dd>
              </div>
              <div>
                <dt>Won</dt>
                <dd>{adminFormat.count(g.spins)}</dd>
              </div>
            </dl>
            <RowActions reward={g} locked={locked} onEdit={() => setEditing({ reward: g })} onDelete={() => setDeleting(g)} />
          </div>
        ))}
      </section>

      <SpinWinRewardDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        campaign={campaign}
        rewards={rewards}
        reward={editing?.reward}
        defaultType={editing?.type}
      />
      <SpinWinProbabilityDialog open={probabilitiesOpen} onOpenChange={setProbabilitiesOpen} campaign={campaign} rewards={rewards} />
      <ConsoleConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "reward"}?`}
        description="It has never been won, so nothing else changes."
        tone="destructive"
        icon={<Trash2 size={18} />}
        confirmLabel="Delete reward"
        pendingLabel="Deleting…"
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
};