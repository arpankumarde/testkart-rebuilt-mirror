import { Link } from "react-router-dom";
import { Trophy, Clock, Users } from "lucide-react";
import type { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { useLiveCountdown } from "../helpers/useLiveCountdown";
import styles from "./HomepageLiveSpotlightCard.module.css";

interface HomepageLiveSpotlightCardProps {
  spotlight: HomepageLiveTestSpotlight;
}

const formatPrizePool = (amount: number): string => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return `₹${amount}`;
};

/**
 * Three stacked sections inside one card: a tinted status strip (status +
 * countdown), the test itself (title, organiser, prize), and an inset stats
 * panel (seats + price). The strip tint follows the status - peach while
 * upcoming, sage once live.
 */
export function HomepageLiveSpotlightCard({ spotlight }: HomepageLiveSpotlightCardProps) {
  const { label, isLive } = useLiveCountdown(spotlight.startTime, spotlight.endTime);

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  const displayTitle = spotlight.examName || spotlight.title;

  const showPrize = spotlight.hasPrizes && spotlight.totalPrizePool > 0;
  const seatsFillPercent = spotlight.maxSeats > 0
    ? Math.min(100, Math.round((spotlight.enrolledCount / spotlight.maxSeats) * 100))
    : null;
  const isFree = spotlight.price === 0;

  return (
    <Link to={`/mock-test/live/${spotlight.id}`} className={styles.cardLink}>
      <article className={`${styles.card} ${isLive ? styles.live : styles.upcoming}`}>
        <div className={styles.statusStrip}>
          <span className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            {isLive ? "LIVE" : "UPCOMING"}
          </span>
          <span className={styles.countdown}>
            <Clock size={13} className={styles.countdownIcon} aria-hidden="true" />
            <span className={styles.countdownText}>{label}</span>
          </span>
        </div>

        <div className={styles.body}>
          <h3 className={styles.testTitle}>{displayTitle}</h3>

          <div className={styles.metaRow}>
            <div className={styles.teacherRow}>
              <Avatar className={styles.avatar}>
                {spotlight.teacherAvatarUrl && <AvatarImage src={spotlight.teacherAvatarUrl} alt={spotlight.teacherName} />}
                <AvatarFallback className={styles.avatarFallback}>{getInitials(spotlight.teacherName)}</AvatarFallback>
              </Avatar>
              <span className={styles.teacherName}>{spotlight.teacherName}</span>
              <VerifiedBadge isVerified={spotlight.teacherIsVerified} size="sm" />
            </div>

            {showPrize && (
              <span className={styles.prizeBadge}>
                <Trophy size={12} className={styles.prizeIcon} aria-hidden="true" />
                {formatPrizePool(spotlight.totalPrizePool)} Prize Pool
              </span>
            )}
          </div>
        </div>

        <div className={styles.stats}>
          {seatsFillPercent !== null && (
            <div className={styles.seatsStat}>
              <span className={styles.statLabel}>
                <Users size={12} aria-hidden="true" />
                Seats
              </span>
              <span className={styles.seatsValue}>
                <strong>{spotlight.enrolledCount.toLocaleString("en-IN")}</strong>
                /{spotlight.maxSeats.toLocaleString("en-IN")} joined
              </span>
              <div className={styles.seatsBarTrack}>
                <div className={styles.seatsBarFill} style={{ width: `${seatsFillPercent}%` }} />
              </div>
            </div>
          )}

          <div className={styles.priceStat}>
            <span className={styles.statLabel}>Entry</span>
            <span className={`${styles.priceValue} ${isFree ? styles.free : styles.paid}`}>
              {isFree ? "Free" : `₹${spotlight.price}`}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
