import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { Checkbox } from "./Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { ImageUploader } from "./ImageUploader";
import { useSaveSpinCampaign } from "../helpers/useSpinWinAdmin";
import {
  dateToZonedInput,
  SPIN_CATEGORIES,
  SPIN_CATEGORY_LABELS,
  SPIN_FUNDING_LABELS,
  SPIN_MAX_DISCOUNT_PERCENT,
  zonedInputToDate,
  type SpinCategory,
} from "../helpers/spinWinRules";
import type { AdminSpinCampaign } from "../helpers/spinWinAdmin";
import styles from "./SpinWinCampaignDialog.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a campaign. */
  campaign?: AdminSpinCampaign;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  bannerUrl: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  terms: string;
  allowGuestSpins: boolean;
  loginRequiredToSpin: boolean;
  maxTotalSpins: string;
  claimDeadline: string;
  redemptionDeadline: string;
  eligibleCategories: SpinCategory[];
  maxDiscountPercent: string;
  discountFunding: "current_split" | "platform_funded";
  popupEnabled: boolean;
  popupDelaySeconds: string;
  seedDiwaliPresets: boolean;
};

const DEFAULT_TZ = "Asia/Kolkata";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

function initialState(campaign?: AdminSpinCampaign): FormState {
  const tz = campaign?.timezone ?? DEFAULT_TZ;
  return {
    name: campaign?.name ?? "",
    slug: campaign?.slug ?? "",
    description: campaign?.description ?? "",
    bannerUrl: campaign?.bannerUrl ?? "",
    timezone: tz,
    startsAt: dateToZonedInput(campaign?.startsAt, tz),
    endsAt: dateToZonedInput(campaign?.endsAt, tz),
    terms: campaign?.terms ?? "",
    allowGuestSpins: campaign?.allowGuestSpins ?? true,
    loginRequiredToSpin: campaign?.loginRequiredToSpin ?? false,
    maxTotalSpins: campaign?.maxTotalSpins ? String(campaign.maxTotalSpins) : "",
    claimDeadline: dateToZonedInput(campaign?.claimDeadline, tz),
    redemptionDeadline: dateToZonedInput(campaign?.redemptionDeadline, tz),
    eligibleCategories: (campaign?.eligibleCategories as SpinCategory[] | undefined) ?? [...SPIN_CATEGORIES],
    maxDiscountPercent: String(campaign?.maxDiscountPercent ?? SPIN_MAX_DISCOUNT_PERCENT),
    discountFunding: (campaign?.discountFunding as FormState["discountFunding"] | undefined) ?? "current_split",
    popupEnabled: campaign?.popupEnabled ?? true,
    popupDelaySeconds: String(campaign?.popupDelaySeconds ?? 6),
    seedDiwaliPresets: !campaign,
  };
}

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];

export const SpinWinCampaignDialog: React.FC<Props> = ({ open, onOpenChange, campaign }) => {
  const [form, setForm] = useState<FormState>(() => initialState(campaign));
  const [slugTouched, setSlugTouched] = useState(!!campaign);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSpinCampaign();
  const navigate = useNavigate();
  const slugLocked = !!campaign && campaign.status !== "draft";

  useEffect(() => {
    if (open) {
      setForm(initialState(campaign));
      setSlugTouched(!!campaign);
      setError(null);
    }
  }, [open, campaign]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (category: SpinCategory, checked: boolean) =>
    set(
      "eligibleCategories",
      checked ? SPIN_CATEGORIES.filter((c) => c === category || form.eligibleCategories.includes(c)) : form.eligibleCategories.filter((c) => c !== category)
    );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const startsAt = zonedInputToDate(form.startsAt, form.timezone);
    const endsAt = zonedInputToDate(form.endsAt, form.timezone);
    if (!startsAt || !endsAt) {
      setError("Set both a start and an end date and time.");
      return;
    }
    save.mutate(
      {
        id: campaign?.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        bannerUrl: form.bannerUrl,
        startsAt,
        endsAt,
        timezone: form.timezone,
        terms: form.terms,
        allowGuestSpins: form.loginRequiredToSpin ? false : form.allowGuestSpins,
        loginRequiredToSpin: form.loginRequiredToSpin,
        maxTotalSpins: form.maxTotalSpins ? Number(form.maxTotalSpins) : null,
        claimDeadline: zonedInputToDate(form.claimDeadline, form.timezone),
        redemptionDeadline: zonedInputToDate(form.redemptionDeadline, form.timezone),
        eligibleCategories: form.eligibleCategories,
        maxDiscountPercent: Number(form.maxDiscountPercent),
        discountFunding: form.discountFunding,
        popupEnabled: form.popupEnabled,
        popupDelaySeconds: Number(form.popupDelaySeconds || 0),
        seedDiwaliPresets: campaign ? undefined : form.seedDiwaliPresets,
      },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          if (!campaign) navigate(`/admin/spin-win/${result.campaign.id}`);
        },
        onError: (err) => setError(err instanceof Error ? err.message : "The campaign could not be saved."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <form onSubmit={submit}>
          <ConsoleDialogHeader
            title={campaign ? "Edit campaign" : "New campaign"}
            description={campaign ? undefined : "Campaigns start as drafts. Publish once the wheel adds up to 100%."}
          />
          <ConsoleDialogBody className={styles.body}>
            <Accordion type="multiple" defaultValue={["basics", "schedule"]} className={styles.accordion}>
              <AccordionItem value="basics">
                <AccordionTrigger>Basic information</AccordionTrigger>
                <AccordionContent>
                  <div className={styles.fields}>
                    <label className={styles.field}>
                      <span className={styles.label}>Campaign name</span>
                      <Input
                        value={form.name}
                        required
                        maxLength={120}
                        placeholder="Diwali Spin & Win 2026"
                        onChange={(e) => {
                          const name = e.target.value;
                          setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Slug</span>
                      <Input
                        value={form.slug}
                        required
                        disabled={slugLocked}
                        maxLength={80}
                        onChange={(e) => {
                          setSlugTouched(true);
                          set("slug", slugify(e.target.value));
                        }}
                      />
                      <span className={styles.hint}>
                        {slugLocked ? "Locked after publishing so shared links keep working." : "Used in the campaign link and coupon prefix."}
                      </span>
                    </label>
                    <label className={`${styles.field} ${styles.full}`}>
                      <span className={styles.label}>Description</span>
                      <Textarea value={form.description} rows={3} maxLength={2000} onChange={(e) => set("description", e.target.value)} />
                    </label>
                    <div className={`${styles.field} ${styles.full}`}>
                      <span className={styles.label}>Banner image</span>
                      <ImageUploader
                        folder="spin-win"
                        currentImageUrl={form.bannerUrl || undefined}
                        aspectRatio="3 / 1"
                        label="Upload banner"
                        onSuccess={({ url }) => set("bannerUrl", url)}
                      />
                      {form.bannerUrl ? (
                        <Button variant="ghost" size="sm" className={styles.inlineAction} onClick={() => set("bannerUrl", "")}>
                          Remove banner
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="schedule">
                <AccordionTrigger>Schedule</AccordionTrigger>
                <AccordionContent>
                  <div className={styles.fields}>
                    <label className={styles.field}>
                      <span className={styles.label}>Starts</span>
                      <Input type="datetime-local" required value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Ends</span>
                      <Input type="datetime-local" required value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
                    </label>
                    <div className={styles.field}>
                      <span className={styles.label}>Timezone</span>
                      <Select value={form.timezone} onValueChange={(value) => set("timezone", value)}>
                        <SelectTrigger aria-label="Timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className={styles.hint}>Dates above are read in this timezone.</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="rules">
                <AccordionTrigger>Spin and claim rules</AccordionTrigger>
                <AccordionContent>
                  <div className={styles.fields}>
                    <div className={`${styles.toggleRow} ${styles.full}`}>
                      <div>
                        <span className={styles.label}>Login required to spin</span>
                        <span className={styles.hint}>Off by default: guests spin once per browser session and log in to claim.</span>
                      </div>
                      <Switch
                        checked={form.loginRequiredToSpin}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, loginRequiredToSpin: checked, allowGuestSpins: checked ? false : prev.allowGuestSpins }))}
                        aria-label="Login required to spin"
                      />
                    </div>
                    <div className={`${styles.toggleRow} ${styles.full}`}>
                      <div>
                        <span className={styles.label}>Guests can spin</span>
                        <span className={styles.hint}>Their reward is held for the session until they log in to claim it.</span>
                      </div>
                      <Switch
                        checked={form.allowGuestSpins}
                        disabled={form.loginRequiredToSpin}
                        onCheckedChange={(checked) => set("allowGuestSpins", checked)}
                        aria-label="Guests can spin"
                      />
                    </div>
                    <p className={`${styles.note} ${styles.full}`}>
                      Always on: one spin per account, one per browser session for guests, login required to claim and redeem.
                    </p>
                    <div className={`${styles.toggleRow} ${styles.full}`}>
                      <div>
                        <span className={styles.label}>Show the popup on the website</span>
                        <span className={styles.hint}>Opens once per browser session on public pages, never during checkout.</span>
                      </div>
                      <Switch checked={form.popupEnabled} onCheckedChange={(checked) => set("popupEnabled", checked)} aria-label="Show the popup on the website" />
                    </div>
                    <label className={styles.field}>
                      <span className={styles.label}>Popup delay (seconds)</span>
                      <Input
                        type="number"
                        min={0}
                        max={120}
                        step={1}
                        disabled={!form.popupEnabled}
                        value={form.popupDelaySeconds}
                        onChange={(e) => set("popupDelaySeconds", e.target.value)}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Campaign-wide spin limit</span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="No limit"
                        value={form.maxTotalSpins}
                        onChange={(e) => set("maxTotalSpins", e.target.value)}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Claim deadline</span>
                      <Input type="datetime-local" value={form.claimDeadline} onChange={(e) => set("claimDeadline", e.target.value)} />
                      <span className={styles.hint}>Blank means the campaign end.</span>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Redemption deadline</span>
                      <Input type="datetime-local" value={form.redemptionDeadline} onChange={(e) => set("redemptionDeadline", e.target.value)} />
                      <span className={styles.hint}>Coupons expire then. Blank means the campaign end.</span>
                    </label>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="eligibility">
                <AccordionTrigger>Eligibility and discounts</AccordionTrigger>
                <AccordionContent>
                  <div className={styles.fields}>
                    <fieldset className={`${styles.fieldset} ${styles.full}`}>
                      <legend className={styles.label}>Coupons apply to</legend>
                      <div className={styles.checks}>
                        {SPIN_CATEGORIES.map((category) => (
                          <label key={category} className={styles.check}>
                            <Checkbox
                              checked={form.eligibleCategories.includes(category)}
                              onChange={(e) => toggleCategory(category, e.target.checked)}
                            />
                            {SPIN_CATEGORY_LABELS[category]}
                          </label>
                        ))}
                      </div>
                      <span className={styles.hint}>Bundles and live tests never take Spin & Win coupons.</span>
                    </fieldset>
                    <label className={styles.field}>
                      <span className={styles.label}>Maximum discount (% of eligible cart)</span>
                      <Input
                        type="number"
                        min={1}
                        max={SPIN_MAX_DISCOUNT_PERCENT}
                        step={0.5}
                        required
                        value={form.maxDiscountPercent}
                        onChange={(e) => set("maxDiscountPercent", e.target.value)}
                      />
                      <span className={styles.hint}>Capped at {SPIN_MAX_DISCOUNT_PERCENT}% by the PRD. Applies to every coupon, flat ones included.</span>
                    </label>
                    <div className={styles.field}>
                      <span className={styles.label}>Discount funding (reporting)</span>
                      <Select value={form.discountFunding} onValueChange={(value) => set("discountFunding", value as FormState["discountFunding"])}>
                        <SelectTrigger aria-label="Discount funding">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SPIN_FUNDING_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className={styles.hint}>Changes the finance reports only. Teacher settlement is unchanged until finance approves.</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="terms">
                <AccordionTrigger>Terms and conditions</AccordionTrigger>
                <AccordionContent>
                  <label className={styles.field}>
                    <span className={styles.label}>Terms</span>
                    <Textarea value={form.terms} rows={8} maxLength={20000} onChange={(e) => set("terms", e.target.value)} />
                    <span className={styles.hint}>Disclose the real winning odds here: wheel slices are equal-sized.</span>
                  </label>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {!campaign ? (
              <label className={styles.check}>
                <Checkbox checked={form.seedDiwaliPresets} onChange={(e) => set("seedDiwaliPresets", e.target.checked)} />
                Start with the Diwali rewards (5%, 10%, 15%, 18%, ₹50, ₹100, ₹150 and Grand Prize, all off at 0%)
              </label>
            ) : null}

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
              {save.isPending ? "Saving…" : campaign ? "Save changes" : "Create draft"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};