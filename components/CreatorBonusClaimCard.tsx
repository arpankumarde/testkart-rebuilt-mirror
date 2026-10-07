import React from "react";
import { Link } from "react-router-dom";
import { Gift, Sparkles } from "lucide-react";
import { useCreatorBonusCheck } from "../helpers/useCreatorBonus";
import { formatRupees, videoReasonText, type CampaignContentType } from "../helpers/teacherCampaignRules";
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
}

/*
 * The Creator Bonus opt-in shown next to "Submit for review". When the item
 * qualifies the teacher ticks it to claim the bonus with this submission; when it
 * does not yet, it shows how far the item has to go. Renders nothing while no
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
}) => {
  const { data } = useCreatorBonusCheck(type, id);
  if (!data || !data.active) return null;
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