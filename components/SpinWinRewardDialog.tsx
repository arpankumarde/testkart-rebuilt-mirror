import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { ImageUploader } from "./ImageUploader";
import { SpinWinWheel } from "./SpinWinWheel";
import { useSaveSpinReward } from "../helpers/useSpinWinAdmin";
import {
  dateToZonedInput,
  flatMinimumOrder,
  rewardTermsProblems,
  SPIN_REWARD_TYPE_LABELS,
  SPIN_REWARD_TYPES,
  SPIN_SEGMENT_COLORS,
  zonedInputToDate,
  type SpinRewardType,
} from "../helpers/spinWinRules";
import { SPIN_REWARD_ICONS } from "../endpoints/admin/spin-win/reward-save_POST.schema";
import type { AdminSpinCampaign, AdminSpinReward } from "../helpers/spinWinAdmin";
import styles from "./SpinWinRewardDialog.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: AdminSpinCampaign;
  rewards: AdminSpinReward[];
  /** Omit to add a reward. */
  reward?: AdminSpinReward;
  /** Type for a new reward, e.g. grand_prize from the Grand Prize card. */
  defaultType?: SpinRewardType;
};

type Form = {
  name: string;
  rewardType: SpinRewardType;
  description: string;
  extraDiscount: "none" | "percentage" | "flat";
  discountValue: string;
  wheelLabel: string;
  segmentColor: string;
  icon: string;
  imageUrl: string;
  probability: string;
  minOrderValue: string;
  maxDiscountAmount: string;
  quantityLimit: string;
  activatesAt: string;
  isActive: boolean;
};

const NO_ICON = "none";

function initial(campaign: AdminSpinCampaign, rewards: AdminSpinReward[], reward?: AdminSpinReward, defaultType?: SpinRewardType): Form {
  const type = reward?.rewardType ?? defaultType ?? "percentage";
  return {
    name: reward?.name ?? (type === "grand_prize" ? "Grand Prize" : ""),
    rewardType: type,
    description: reward?.description ?? "",
    extraDiscount: reward?.discountType && (type === "grand_prize" || type === "other") ? reward.discountType : "none",
    discountValue: reward?.discountValue != null ? String(reward.discountValue) : "",
    wheelLabel: reward?.wheelLabel ?? (type === "grand_prize" ? "Grand Prize" : ""),
    segmentColor: reward?.segmentColor ?? SPIN_SEGMENT_COLORS[rewards.length % SPIN_SEGMENT_COLORS.length],
    icon: reward?.icon ?? (type === "grand_prize" ? "gift" : NO_ICON),
    imageUrl: reward?.imageUrl ?? "",
    probability: String(reward?.probability ?? 0),
    minOrderValue: reward?.minOrderValue != null ? String(reward.minOrderValue) : "",
    maxDiscountAmount: reward?.maxDiscountAmount != null ? String(reward.maxDiscountAmount) : "",
    quantityLimit: reward?.quantityLimit != null ? String(reward.quantityLimit) : "",
    activatesAt: dateToZonedInput(reward?.activatesAt, campaign.timezone),
    isActive: reward?.isActive ?? false,
  };
}

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

export const SpinWinRewardDialog: React.FC<Props> = ({ open, onOpenChange, campaign, rewards, reward, defaultType }) => {
  const [form, setForm] = useState<Form>(() => initial(campaign, rewards, reward, defaultType));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSpinReward();

  useEffect(() => {
    if (open) {
      setForm(initial(campaign, rewards, reward, defaultType));
      setError(null);
    }
  }, [open, campaign, rewards, reward, defaultType]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const discountType =
    form.rewardType === "percentage" || form.rewardType === "flat" ? form.rewardType : form.extraDiscount === "none" ? null : form.extraDiscount;
  const discountValue = numberOrNull(form.discountValue);
  const maxPercent = campaign.maxDiscountPercent;
  const suggestedMin = discountType === "flat" && discountValue ? flatMinimumOrder(discountValue, maxPercent) : null;
  const isSpecial = form.rewardType === "grand_prize" || form.rewardType === "other";

  const problems = useMemo(
    () =>
      rewardTermsProblems(
        {
          rewardType: form.rewardType,
          discountType,
          discountValue,
          minOrderValue: numberOrNull(form.minOrderValue),
          maxDiscountAmount: numberOrNull(form.maxDiscountAmount),
        },
        maxPercent
      ),
    [form, discountType, discountValue, maxPercent]
  );

  const previewSegments = useMemo(() => {
    const others = rewards.filter((r) => r.isActive && r.id !== reward?.id).map((r) => ({ key: r.id, label: r.wheelLabel, color: r.segmentColor, sort: r.sortOrder }));
    const self = form.isActive ? [{ key: "this", label: form.wheelLabel || "New reward", color: form.segmentColor, sort: reward?.sortOrder ?? 9999 }] : [];
    return [...others, ...self].sort((a, b) => a.sort - b.sort);
  }, [rewards, reward, form.isActive, form.wheelLabel, form.segmentColor]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (problems.length > 0) {
      setError(problems.join(" "));
      return;
    }
    save.mutate(
      {
        id: reward?.id,
        campaignId: campaign.id,
        name: form.name,
        rewardType: form.rewardType,
        description: form.description,
        discountType,
        discountValue: discountType ? discountValue : null,
        wheelLabel: form.wheelLabel,
        segmentColor: form.segmentColor.toUpperCase(),
        icon: form.icon === NO_ICON ? null : (form.icon as (typeof SPIN_REWARD_ICONS)[number]),
        imageUrl: form.imageUrl,
        probability: Number(form.probability || 0),
        minOrderValue: discountType ? numberOrNull(form.minOrderValue) : null,
        maxDiscountAmount: discountType === "percentage" ? numberOrNull(form.maxDiscountAmount) : null,
        quantityLimit: numberOrNull(form.quantityLimit),
        activatesAt: zonedInputToDate(form.activatesAt, campaign.timezone),
        isActive: form.isActive,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(err instanceof Error ? err.message : "The reward could not be saved."),
      }
    );
  };

  const title = reward ? `Edit ${reward.name}` : form.rewardType === "grand_prize" ? "Add Grand Prize" : "Add reward";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="xl">
        <form onSubmit={submit}>
          <ConsoleDialogHeader title={title} description={reward && reward.spins > 0 ? `Won ${reward.spins} times. Changes apply to future spins only.` : undefined} />
          <ConsoleDialogBody className={styles.layout}>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span className={styles.label}>Reward name</span>
                <Input value={form.name} required maxLength={80} onChange={(e) => set("name", e.target.value)} />
              </label>
              <div className={styles.field}>
                <span className={styles.label}>Reward type</span>
                <Select value={form.rewardType} onValueChange={(value) => set("rewardType", value as SpinRewardType)} disabled={!!reward && reward.spins > 0}>
                  <SelectTrigger aria-label="Reward type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPIN_REWARD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SPIN_REWARD_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className={`${styles.field} ${styles.full}`}>
                <span className={styles.label}>Description</span>
                <Textarea value={form.description} rows={2} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
              </label>

              {isSpecial ? (
                <div className={`${styles.field} ${styles.full}`}>
                  <span className={styles.label}>Coupon issued</span>
                  <Select value={form.extraDiscount} onValueChange={(value) => set("extraDiscount", value as Form["extraDiscount"])}>
                    <SelectTrigger aria-label="Coupon issued">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None, fulfilled by the team</SelectItem>
                      <SelectItem value="percentage">Percentage discount coupon</SelectItem>
                      <SelectItem value="flat">Flat discount coupon</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.rewardType === "grand_prize" ? (
                    <span className={styles.hint}>The Grand Prize benefit is still to be decided. Leave this as None until it is approved.</span>
                  ) : null}
                </div>
              ) : null}

              {discountType ? (
                <>
                  <label className={styles.field}>
                    <span className={styles.label}>{discountType === "percentage" ? "Discount (%)" : "Discount (₹)"}</span>
                    <Input
                      type="number"
                      required
                      min={discountType === "percentage" ? 0.5 : 1}
                      max={discountType === "percentage" ? maxPercent : undefined}
                      step={discountType === "percentage" ? 0.5 : 1}
                      value={form.discountValue}
                      onChange={(e) => set("discountValue", e.target.value)}
                    />
                    {discountType === "percentage" ? <span className={styles.hint}>At most {maxPercent}%.</span> : null}
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Minimum eligible order (₹)</span>
                    <Input type="number" min={0} step={1} value={form.minOrderValue} onChange={(e) => set("minOrderValue", e.target.value)} />
                    {suggestedMin !== null ? (
                      <span className={styles.hint}>
                        Needs at least ₹{suggestedMin} (₹{discountValue} / {maxPercent / 100}).{" "}
                        <button type="button" className={styles.linkButton} onClick={() => set("minOrderValue", String(suggestedMin))}>
                          Use ₹{suggestedMin}
                        </button>
                      </span>
                    ) : null}
                  </label>
                  {discountType === "percentage" ? (
                    <label className={styles.field}>
                      <span className={styles.label}>Maximum discount (₹)</span>
                      <Input type="number" min={1} step={1} placeholder="No cap" value={form.maxDiscountAmount} onChange={(e) => set("maxDiscountAmount", e.target.value)} />
                      <span className={styles.hint}>The {maxPercent}% cart cap applies either way.</span>
                    </label>
                  ) : null}
                </>
              ) : null}

              <label className={styles.field}>
                <span className={styles.label}>Wheel label</span>
                <Input value={form.wheelLabel} required maxLength={20} onChange={(e) => set("wheelLabel", e.target.value)} />
              </label>
              <div className={styles.field}>
                <span className={styles.label}>Icon</span>
                <Select value={form.icon} onValueChange={(value) => set("icon", value)}>
                  <SelectTrigger aria-label="Icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ICON}>No icon</SelectItem>
                    {SPIN_REWARD_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon[0].toUpperCase() + icon.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <span className={styles.label}>Segment colour</span>
                <div className={styles.swatches}>
                  {SPIN_SEGMENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`${styles.swatch} ${form.segmentColor.toUpperCase() === color ? styles.swatchActive : ""}`}
                      style={{ background: color }}
                      aria-label={`Use ${color}`}
                      aria-pressed={form.segmentColor.toUpperCase() === color}
                      onClick={() => set("segmentColor", color)}
                    />
                  ))}
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={form.segmentColor}
                    aria-label="Custom colour"
                    onChange={(e) => set("segmentColor", e.target.value)}
                  />
                </div>
              </div>

              {form.rewardType === "grand_prize" ? (
                <div className={`${styles.field} ${styles.full}`}>
                  <span className={styles.label}>Prize image</span>
                  <ImageUploader folder="spin-win" currentImageUrl={form.imageUrl || undefined} aspectRatio="1 / 1" label="Upload image" onSuccess={({ url }) => set("imageUrl", url)} />
                </div>
              ) : null}

              <label className={styles.field}>
                <span className={styles.label}>Winning probability (%)</span>
                <Input type="number" min={0} max={100} step={0.001} required value={form.probability} onChange={(e) => set("probability", e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Quantity available</span>
                <Input type="number" min={0} step={1} placeholder="Unlimited" value={form.quantityLimit} onChange={(e) => set("quantityLimit", e.target.value)} />
                <span className={styles.hint}>When it runs out, its odds spread over the rest.</span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Available from</span>
                <Input type="datetime-local" value={form.activatesAt} onChange={(e) => set("activatesAt", e.target.value)} />
                <span className={styles.hint}>{campaign.timezone}. Before then its odds spread over the rest.</span>
              </label>
              <div className={`${styles.toggleRow}`}>
                <span className={styles.label}>Reward on</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} aria-label="Reward on" />
              </div>
            </div>

            <aside className={styles.preview} aria-label="Wheel preview">
              <span className={styles.label}>Wheel preview</span>
              <SpinWinWheel segments={previewSegments} size={260} />
              <span className={styles.hint}>Only rewards that are on appear on the wheel.</span>
            </aside>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : reward ? "Save reward" : "Add reward"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};