import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Gift, Newspaper, Sparkles } from "lucide-react";
import { useCreatorBonusCheck } from "../helpers/useCreatorBonus";
import { usePublishesWithoutReview } from "../helpers/usePublishesWithoutReview";
import {
  formatRupees,
  videoReasonText,
  type CampaignContentType,
  type ExamBonusOption,
} from "../helpers/teacherCampaignRules";
import type { OutputType as CheckOutput } from "../endpoints/teacher/creator-bonus/check_GET.schema";
import styles from "./CreatorBonusClaimCard.module.css";

const MAX_LISTED_VIDEOS = 4;

interface CreatorBonusClaimCardProps {
  type: CampaignContentType;
  id: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Sitting on a coral brand block: the claim card turns white so it does not melt into it. */
  onBrand?: boolean;
  className?: string;
  /** Test series: the Exam Bonus picked in place of the Creator Bonus, if any. */
  examCampaignId?: number | null;
  onExamCampaignChange?: (campaignId: number | null) => void;
}

const formatEndDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

type ExamOfferProps = {
  option: ExamBonusOption;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  onBrand?: boolean;
  publishesDirectly: boolean;
};

const ExamOffer: React.FC<ExamOfferProps> = ({ option, checked, onCheckedChange, disabled, onBrand, publishesDirectly }) => {
  const amount = formatRupees(option.amount);
  return (
    <label className={`${styles.card} ${styles.claimable} ${onBrand ? styles.onBrand : ""} ${checked ? styles.checked : ""}`}>
      <span className={styles.blob} aria-hidden="true">
        <Newspaper size={20} />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>Claim the {amount} {option.title}</span>
        <span className={styles.slots}>
          {option.slotsLeft} of {option.totalSlots} slots left · ends {formatEndDate(option.endsAt)}
        </span>
        <span className={styles.text}>
          Slots are shared by all teachers, and one is yours once you submit. A test series earns one bonus, so this
          takes the place of the Creator Bonus. Our team credits it only for high quality work.
          {publishesDirectly &&
            " Claiming sends it to our team for review first; without the claim it goes live straight away."}
        </span>
        <span className={styles.tick}>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onCheckedChange(event.target.checked)}
          />
          <span>Yes, claim {amount} with this submission</span>
        </span>
      </span>
    </label>
  );
};

/*
 * The bonus opt-in shown next to "Submit for review" (or "Publish"). A claim
 * always goes through review, even for a verified teacher. When the item
 * qualifies the teacher ticks it to claim the bonus with this submission; when it
 * does not yet, it shows how far the item has to go. A test series tagged with an
 * exam in a running Exam Bonus also gets one card per campaign, and the ticks
 * rule each other out because a series earns one bonus. Renders nothing while no
 * campaign is running.
 */
export const CreatorBonusClaimCard: React.FC<CreatorBonusClaimCardProps> = ({
  type,
  id,
  checked,
  onCheckedChange,
  disabled,
  onBrand,
  className,
  examCampaignId,
  onExamCampaignChange,
}) => {
  const { data } = useCreatorBonusCheck(type, id);
  const publishesDirectly = usePublishesWithoutReview();
  const examOptions = data?.examOptions ?? [];
  const pickGone =
    examCampaignId != null && !!data && !examOptions.some((o) => o.campaignId === examCampaignId && o.canClaim);

  // A slot can go, or the campaign can end, while this page sits open.
  useEffect(() => {
    if (pickGone) onExamCampaignChange?.(null);
  }, [pickGone, onExamCampaignChange]);

  if (!data) return null;

  const creatorOffer = data.active ? (
    <CreatorOffer
      data={data}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      onBrand={onBrand}
      className={examOptions.length === 0 ? className : undefined}
      publishesDirectly={publishesDirectly}
    />
  ) : null;
  if (examOptions.length === 0) return creatorOffer;

  const creatorReason = data.active ? data.reason : null;
  const open = examOptions.filter((o) => o.canClaim);
  const closed = examOptions.filter((o) => !o.canClaim && o.reason !== creatorReason);

  return (
    <div className={`${styles.stack} ${className ?? ""}`}>
      {open.map((option) => (
        <ExamOffer
          key={option.campaignId}
          option={option}
          checked={examCampaignId === option.campaignId}
          onCheckedChange={(on) => onExamCampaignChange?.(on ? option.campaignId : null)}
          disabled={disabled}
          onBrand={onBrand}
          publishesDirectly={publishesDirectly}
        />
      ))}
      {closed.map((option) => (
        <p key={option.campaignId} className={styles.quiet}>
          <Newspaper size={14} aria-hidden="true" />
          <span>
            {option.title}: {option.reason}
          </span>
        </p>
      ))}
      {creatorOffer}
    </div>
  );
};

type CreatorOfferProps = {
  data: Extract<CheckOutput, { active: true }>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  onBrand?: boolean;
  className?: string;
  publishesDirectly: boolean;
};

const CreatorOffer: React.FC<CreatorOfferProps> = ({
  data,
  checked,
  onCheckedChange,
  disabled,
  onBrand,
  className,
  publishesDirectly,
}) => {
  const amount = formatRupees(data.amount);

  if (data.canClaim) {
    return (
      <label
        className={`${styles.card} ${styles.claimable} ${onBrand ? styles.onBrand : ""} ${checked ? styles.checked : ""} ${className ?? ""}`}
      >
        <span className={styles.blob} aria-hidden="true">
          <Gift size={20} />
        </span>
        <span className={styles.body}>
          <span className={styles.title}>Claim the {amount} {data.title}</span>
          <span className={styles.text}>
            This qualifies. Tick to claim it with this submission. Approval and the bonus are separate: our team
            credits it only for high quality work.
            {publishesDirectly &&
              " Claiming sends it to our team for review first; without the claim it goes live straight away."}
          </span>
          <span className={styles.tick}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => onCheckedChange(event.target.checked)}
            />
            <span>Yes, claim {amount} with this submission</span>
          </span>
        </span>
      </label>
    );
  }

  if (data.progress && data.progress.some((p) => p.have < p.need)) {
    const uncounted = (data.videos ?? []).filter((v) => !v.counted);
    return (
      <div className={`${styles.card} ${styles.building} ${className ?? ""}`}>
        <span className={`${styles.blob} ${styles.blobButter}`} aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <span className={styles.body}>
          <span className={styles.title}>Unlock the {amount} {data.title}</span>
          <span className={styles.meters}>
            {data.progress.map((p) => (
              <span key={p.label} className={styles.meter}>
                <span className={styles.meterLabel}>
                  {Math.min(p.have, p.need).toLocaleString("en-IN")} / {p.need.toLocaleString("en-IN")} {p.label}
                </span>
                <span className={styles.meterTrack}>
                  <span className={styles.meterFill} style={{ width: `${Math.min(100, (p.have / p.need) * 100)}%` }} />
                </span>
              </span>
            ))}
          </span>
          {uncounted.length > 0 && (
            <span className={styles.uncounted}>
              <span className={styles.uncountedHead}>
                {uncounted.length} {uncounted.length === 1 ? "video does" : "videos do"} not count yet
              </span>
              <ul className={styles.uncountedList}>
                {uncounted.slice(0, MAX_LISTED_VIDEOS).map((v, i) => (
                  <li key={i}>
                    <span className={styles.videoTitle}>{v.title}</span>
                    <span className={styles.videoReason}>{videoReasonText(v.reason!, data.minMinutesPerVideo)}</span>
                  </li>
                ))}
              </ul>
              {uncounted.length > MAX_LISTED_VIDEOS && (
                <span className={styles.more}>and {uncounted.length - MAX_LISTED_VIDEOS} more</span>
              )}
            </span>
          )}
          <Link to="/teacher/creator-bonus" className={styles.link}>
            How the Creator Bonus works
          </Link>
        </span>
      </div>
    );
  }

  return (
    <p className={`${styles.quiet} ${className ?? ""}`}>
      <Gift size={14} aria-hidden="true" />
      <span>
        {data.reason}{" "}
        <Link to="/teacher/creator-bonus" className={styles.link}>
          See your Creator Bonus
        </Link>
      </span>
    </p>
  );
};