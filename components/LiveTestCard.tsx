import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Calendar, Users, Trophy, IndianRupee, Clock, BookOpen } from 'lucide-react';
import { Badge } from './Badge';
import { Progress } from './Progress';
import { useCountdownTimer } from '../helpers/useCountdownTimer';
import { getLiveTestStatus } from '../helpers/useLiveTestHelpers';
import { Placeholder } from '../helpers/placeholderImages';
import type { LiveTestListItem } from '../endpoints/live-tests/list_GET.schema';
import styles from './LiveTestCard.module.css';

interface LiveTestCardProps {
  liveTest: LiveTestListItem;
  className?: string;
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

const CountdownDisplay: React.FC<{ target: Date; label: string }> = ({ target, label }) => {
  const { days, hours, minutes, seconds, isComplete } = useCountdownTimer(target);

  if (isComplete) {
    return null;
  }

  return (
    <div className={styles.countdown}>
      <Clock size={14} />
      <span>
        {label}: {days > 0 && `${days}d `}
        {hours > 0 && `${hours}h `}
        {minutes > 0 && `${minutes}m `}
        {seconds}s
      </span>
    </div>
  );
};

export const LiveTestCard: React.FC<LiveTestCardProps> = ({ liveTest, className }) => {
  const status = getLiveTestStatus(liveTest);
  const isFree = liveTest.price === 0;
  const isEnded = status === 'ended';
  const isFull = status === 'seats_full';
  const enrollmentPercentage = liveTest.maxSeats > 0 ? (liveTest.enrolledCount / liveTest.maxSeats) * 100 : 0;

  const ctaLabel = isEnded
    ? liveTest.hasAttempted
      ? 'View Results'
      : 'Test Ended'
    : liveTest.isEnrolled
      ? 'View Details'
      : isFull
        ? 'Seats Full'
        : 'Join Now';

  return (
    <Link to={`/mock-test/live/${liveTest.id}`} className={`${styles.cardWrapper} ${className || ''}`}>
      <div className={styles.card}>
        <div className={styles.thumbnail}>
          <img
            src={liveTest.thumbnailUrl || Placeholder.LIVE}
            alt={liveTest.title}
            className={styles.thumbnailImage}
          />
        </div>

        <div className={styles.cardContent}>
          <div className={styles.badgesRow}>
            {status === 'live' && (
              <Badge variant="destructive" className={styles.liveBadge}>
                <Zap size={12} /> LIVE NOW
              </Badge>
            )}
            {status === 'upcoming' && <Badge variant="secondary">Upcoming</Badge>}
            {isEnded && <Badge variant="outline">Ended</Badge>}
            {liveTest.examName && <Badge variant="outline">{liveTest.examName}</Badge>}
          </div>

          <h3 className={styles.title}>{liveTest.title}</h3>
          <p className={styles.creator}>by {liveTest.teacherName}</p>

          {status === 'upcoming' && liveTest.startTime && (
            <CountdownDisplay target={liveTest.startTime} label="Starts in" />
          )}
          {status === 'live' && <CountdownDisplay target={liveTest.endTime} label="Ends in" />}

          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <Calendar size={16} />
              </span>
              <span className={styles.infoText}>
                <span className={styles.infoLabel}>{liveTest.startTime && !isEnded ? 'Starts:' : 'Ended:'}</span>
                <span className={styles.infoValue}>
                  {formatDate(isEnded ? liveTest.endTime : liveTest.startTime ?? liveTest.endTime)}
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <BookOpen size={16} />
              </span>
              <span className={styles.infoText}>
                <span className={styles.infoLabel}>Questions:</span>
                <span className={styles.infoValue}>
                  {liveTest.actualQuestionCount} &middot; {liveTest.durationMinutes} mins
                </span>
              </span>
            </div>
          </div>

          {liveTest.hasPrizes && liveTest.totalPrizePool > 0 && (
            <div className={styles.prizeBreakdown}>
              <div className={styles.prizeHeader}>
                <Trophy size={16} />
                <span className={styles.prizeHeaderText}>
                  Prize Pool: {formatCurrency(liveTest.totalPrizePool)}
                </span>
              </div>
            </div>
          )}

          <div className={styles.seatsInfo}>
            <span className={styles.seatsText}>
              <Users size={14} />
              {liveTest.enrolledCount} / {liveTest.maxSeats} seats filled
            </span>
            <Progress value={enrollmentPercentage} className={styles.progressBar} />
          </div>
        </div>

        <div className={styles.cardFooter}>
          <div
            className={`${styles.ctaButton} ${isEnded && !liveTest.hasAttempted ? styles.ctaButtonDisabled : ''}`}
          >
            <span className={styles.ctaText}>{ctaLabel}</span>
            {!isFree && !isEnded && !liveTest.isEnrolled && (
              <span className={styles.ctaPriceBadge}>
                <IndianRupee size={14} strokeWidth={2.5} />
                {liveTest.price}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
