import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
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

export function HomepageLiveSpotlightCard({ spotlight }: HomepageLiveSpotlightCardProps) {
  const { label, isLive } = useLiveCountdown(spotlight.startTime, spotlight.endTime);

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  const displayTitle = spotlight.examName || spotlight.title;

  const showPrize = spotlight.hasPrizes && spotlight.totalPrizePool > 0;
  const seatsFillPercent = spotlight.maxSeats > 0
    ? Math.min(100, Math.round((spotlight.enrolledCount / spotlight.maxSeats) * 100))
    : null;

  return (
    <Link to={`/mock-test/live/${spotlight.id}`} className={styles.cardLink}>
      <div className={styles.card}>
        <div className={styles.topRow}>
          {showPrize ? (
            <div className={styles.prizeBadge}>
              <Trophy size={12} className={styles.prizeIcon} />
              <span>{formatPrizePool(spotlight.totalPrizePool)} Prize Pool</span>
            </div>
          ) : <span />}
          <div className={styles.badge}>
            <span className={`${styles.badgeDot} ${isLive ? styles.liveDot : styles.upcomingDot}`} />
            <span className={styles.badgeText}>{isLive ? "LIVE" : "UPCOMING"}</span>
          </div>
        </div>

        <div className={styles.teacherRow}>
          <Avatar className={styles.avatar}>
            {spotlight.teacherAvatarUrl && <AvatarImage src={spotlight.teacherAvatarUrl} alt={spotlight.teacherName} />}
            <AvatarFallback className={styles.avatarFallback}>{getInitials(spotlight.teacherName)}</AvatarFallback>
          </Avatar>
          <div className={styles.teacherInfo}>
            <span className={styles.teacherName}>{spotlight.teacherName}</span>
            <VerifiedBadge isVerified={spotlight.teacherIsVerified} size="sm" />
          </div>
        </div>

        <span className={styles.testTitle}>{displayTitle}</span>

        {seatsFillPercent !== null && (
          <div className={styles.seatsRow}>
            <div className={styles.seatsBarTrack}>
              <div className={styles.seatsBarFill} style={{ width: `${seatsFillPercent}%` }} />
            </div>
            <span className={styles.seatsLabel}>
              🔥 {spotlight.enrolledCount.toLocaleString("en-IN")}/{spotlight.maxSeats.toLocaleString("en-IN")} joined
            </span>
          </div>
        )}

        <div className={styles.bottomRow}>
          <span className={styles.countdown}>{label}</span>
          <span className={`${styles.priceBadge} ${spotlight.price === 0 ? styles.free : styles.paid}`}>
            {spotlight.price === 0 ? "Free" : `₹${spotlight.price}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
