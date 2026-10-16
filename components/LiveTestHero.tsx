import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../helpers/useAuth';
import { Clock, Users, Calendar, CalendarClock, CheckCircle, XCircle, IndianRupee, PlayCircle, Info, ChevronRight, FileText, BookOpen, Trophy, Medal, Hourglass } from 'lucide-react';
import { useCountdownTimer } from '../helpers/useCountdownTimer';
import { getLiveTestStatus } from '../helpers/useLiveTestHelpers';
import { Placeholder } from '../helpers/placeholderImages';

import { VerifiedBadge } from './VerifiedBadge';
import { PlayfulButton, playfulButtonClass } from './PlayfulButton';
import { Progress } from './Progress';
import { Badge } from './Badge';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import type { OutputType as LiveTestDetails } from '../endpoints/live-tests/details_GET.schema';
import { useLiveTestEnrollment } from '../helpers/useLiveTestEnrollment';
import { postLiveTestsPurchase } from '../endpoints/live-tests/purchase_POST.schema';
import { postPaymentPayuRedirect } from '../endpoints/payment/payu/redirect_POST.schema';
import { postPaymentPayuVerifyAndComplete } from '../endpoints/payment/payu/verify-and-complete_POST.schema';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { LIVE_TESTS_PATH } from '../helpers/liveTestRoutes';
import { LIVE_TEST_DETAILS_QUERY_KEY_PREFIX } from '../helpers/useLiveTestDetailsQuery';
import { LIVE_TESTS_QUERY_KEY } from '../helpers/useLiveTestsQuery';
import { AssetTopRow } from './AssetTopRow';
import { VideoPreview } from "./VideoPreview";
import styles from './LiveTestHero.module.css';

interface LiveTestHeroProps {
  liveTest: LiveTestDetails;
  className?: string;
}

type Tone = 'peach' | 'lavender' | 'blue' | 'sage' | 'yellow';

const TIMER_TONES: Tone[] = ['peach', 'lavender', 'blue', 'sage'];
const VISIBLE_TOPICS = 4;

const STATUS_LABELS: Record<ReturnType<typeof getLiveTestStatus>, string> = {
  live: 'LIVE NOW',
  upcoming: 'UPCOMING',
  ended: 'ENDED',
  registration_closed: 'REGISTRATION CLOSED',
  seats_full: 'SEATS FULL',
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatDay = (date: Date | string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date));

const formatTime = (date: Date | string) =>
  new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(new Date(date));

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const CountdownTimer: React.FC<{ target: Date; label: string }> = ({ target, label }) => {
  const { days, hours, minutes, seconds, isComplete } = useCountdownTimer(target);

  if (isComplete) {
    return null;
  }

  const blocks = [
    { value: days, unit: 'Days' },
    { value: hours, unit: 'Hours' },
    { value: minutes, unit: 'Mins' },
    { value: seconds, unit: 'Secs' },
  ];

  return (
    <div className={styles.countdown}>
      <div className={styles.countdownLabel}>{label}</div>
      <div className={styles.countdownTimer}>
        {blocks.map((block, index) => (
          <React.Fragment key={block.unit}>
            {index > 0 && <div className={styles.timerSeparator} aria-hidden="true">:</div>}
            <div className={`${styles.timerBlock} ${styles[`tone_${TIMER_TONES[index]}`]}`}>
              <span>{String(block.value).padStart(2, '0')}</span>
              <small>{block.unit}</small>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const DetailItem: React.FC<{
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  wide?: boolean;
}> = ({ icon, tone, label, value, sub, wide }) => (
  <div className={`${styles.detailItem} ${wide ? styles.detailWide : ''}`}>
    <span className={`${styles.iconTile} ${styles[`tone_${tone}`]}`}>{icon}</span>
    <div className={styles.detailText}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
      {sub && <span className={styles.detailSub}>{sub}</span>}
    </div>
  </div>
);

const TopicChips: React.FC<{ topics: string[] }> = ({ topics }) => {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = topics.length - VISIBLE_TOPICS;
  const shown = expanded || hiddenCount <= 1 ? topics : topics.slice(0, VISIBLE_TOPICS);

  return (
    <div className={styles.topicList}>
      {shown.map((topic, index) => (
        <span key={`${topic}-${index}`} className={styles.topicChip}>{topic}</span>
      ))}
      {!expanded && hiddenCount > 1 && (
        <button type="button" className={playfulButtonClass('soft', 'xs')} onClick={() => setExpanded(true)}>
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
};

export const LiveTestHero: React.FC<LiveTestHeroProps> = ({ liveTest, className }) => {
  const status = getLiveTestStatus(liveTest);
  const isFree = liveTest.price === 0;
  const enrollmentPercentage = liveTest.maxSeats > 0 ? (liveTest.enrolledCount / liveTest.maxSeats) * 100 : 0;
  const enrollmentMutation = useLiveTestEnrollment();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Countdown for enrolled users waiting for test to start (only if startTime is not null)
  const startCountdown = useCountdownTimer(liveTest.startTime ?? new Date());
  
  const formatInlineCountdown = (countdown: { days: number; hours: number; minutes: number; seconds: number }) => {
    const parts = [];
    if (countdown.days > 0) parts.push(`${countdown.days}d`);
    if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
    if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`);
    if (countdown.seconds > 0) parts.push(`${countdown.seconds}s`);
    return parts.join(' ') || '0s';
  };

  const handleFreeEnroll = () => {
    if (authState.type !== 'authenticated') {
      const currentPath = location.pathname + location.search;
      toast.info('Please login to enroll in this live test');
      console.log('User needs to login before enrolling in live test');
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    enrollmentMutation.mutate({ liveTestId: liveTest.id });
  };

  const handlePaidEnroll = async () => {
    if (authState.type !== 'authenticated') {
      const currentPath = location.pathname + location.search;
      toast.info('Please login to enroll in this live test');
      console.log('User needs to login before enrolling in live test');
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    setIsProcessingPayment(true);
    try {
      toast.loading("Initiating payment...");
      const paymentData = await postLiveTestsPurchase({ liveTestId: liveTest.id });
      toast.dismiss();
      toast.loading("Redirecting to payment gateway...");
      // Use the proxy redirect endpoint to avoid CSP form-action restrictions
      postPaymentPayuRedirect(paymentData);
      // Note: The page will redirect, so we don't set loading to false
    } catch (error) {
      setIsProcessingPayment(false);
      toast.dismiss();
      const errorMessage = error instanceof Error ? error.message : "Failed to initiate payment";
      toast.error(errorMessage);
      console.error("Payment initiation error:", error);
    }
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryStatus = urlParams.get('status');
    const orderIdParam = urlParams.get('order_id');
    const txnid = urlParams.get('txnid');

    if (queryStatus === 'success' && orderIdParam && !isVerifyingPayment) {
      const orderId = parseInt(orderIdParam, 10);

      if (isNaN(orderId)) {
        toast.error("Invalid order ID in payment response");
        return;
      }

      window.history.replaceState({}, '', window.location.pathname);

      setIsVerifyingPayment(true);
      const verificationToastId = toast.loading("Verifying payment...");

      postPaymentPayuVerifyAndComplete({
        txnid: txnid ?? undefined,
        orderId: orderId,
      })
        .then((result) => {
          toast.dismiss(verificationToastId);

          if (result.success && result.orderStatus === 'completed') {
            toast.success("Payment successful! You are now enrolled.");
            queryClient.invalidateQueries({ queryKey: LIVE_TESTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX] });
          } else if (result.orderStatus === 'pending') {
            toast.warning("Payment is still pending. Please wait a moment and refresh the page.");
          } else {
            toast.error(`Payment verification failed: ${result.message}`);
          }
        })
        .catch((error) => {
          toast.dismiss(verificationToastId);
          const errorMessage = error instanceof Error ? error.message : "Payment verification failed";
          toast.error(`Verification error: ${errorMessage}`);
          console.error("Payment verification error:", error);
        })
        .finally(() => {
          setIsVerifyingPayment(false);
        });
    }
  }, [liveTest.id, queryClient, isVerifyingPayment]);

  const renderCTA = () => {
    if (authState.type === 'authenticated' && authState.user.role === 'teacher') {
      return null;
    }

    if (status === 'ended') {
      return (
        <PlayfulButton size="lg" className={styles.ctaButton} disabled>
          <XCircle size={20} /> Test Ended
        </PlayfulButton>
      );
    }

    const now = new Date();
    const hasExpired = now > new Date(liveTest.endTime);
    
    if (status === 'live' && liveTest.isEnrolled) {
      if (liveTest.hasAttempted) {
        return (
          <PlayfulButton size="lg" className={styles.ctaButton} disabled>
            <CheckCircle size={20} /> Already Attempted
          </PlayfulButton>
        );
      }
      if (hasExpired) {
        return (
          <PlayfulButton size="lg" className={styles.ctaButton} disabled>
            <XCircle size={20} /> Test Ended
          </PlayfulButton>
        );
      }
      return (
        <PlayfulButton 
          size="lg" 
          className={styles.ctaButton}
          onClick={() => navigate(`/live-portal/${liveTest.id}`)}
          disabled={enrollmentMutation.isPending}
        >
          <PlayCircle size={20} /> {enrollmentMutation.isPending ? 'Loading...' : 'Start Test'}
        </PlayfulButton>
      );
    }
    if (status === 'registration_closed' && liveTest.isEnrolled) {
      if (liveTest.startTime) {
        return (
          <PlayfulButton size="lg" className={styles.ctaButton} disabled>
            <Clock size={20} /> Test starts in: {formatInlineCountdown(startCountdown)}
          </PlayfulButton>
        );
      }
      return (
        <PlayfulButton size="lg" className={styles.ctaButton} disabled>
          <Clock size={20} /> Waiting for test to begin
        </PlayfulButton>
      );
    }
    if (liveTest.canEnroll) {
      if (isFree) {
        return (
          <PlayfulButton 
            size="lg" 
            className={styles.ctaButton}
            onClick={handleFreeEnroll}
            disabled={enrollmentMutation.isPending || isVerifyingPayment}
          >
            {enrollmentMutation.isPending ? 'Enrolling...' : isVerifyingPayment ? 'Verifying...' : 'Enroll for Free'}
          </PlayfulButton>
        );
      } else {
        return (
          <PlayfulButton 
            size="lg" 
            className={styles.ctaButton}
            onClick={handlePaidEnroll}
            disabled={isProcessingPayment || isVerifyingPayment}
          >
            {isProcessingPayment ? (
              'Processing...'
            ) : isVerifyingPayment ? (
              'Verifying Payment...'
            ) : (
              <>
                <span className={styles.ctaText}>Enter Contest</span>
                <span className={styles.ctaPriceBadge}>
                  {liveTest.discountPrice !== null && (
                    <s className={styles.ctaOriginalPrice}>₹{liveTest.price}</s>
                  )}
                  <IndianRupee size={16} strokeWidth={2.5} />
                  {liveTest.discountPrice ?? liveTest.price}
                </span>
              </>
            )}
          </PlayfulButton>
        );
      }
    }
    if (liveTest.isEnrolled) {
      if (hasExpired) {
        return <PlayfulButton size="lg" className={styles.ctaButton} disabled><XCircle size={20} /> Test Ended</PlayfulButton>;
      }
      return <PlayfulButton size="lg" className={styles.ctaButton} disabled><CheckCircle size={20} /> Enrolled</PlayfulButton>;
    }
    return <PlayfulButton size="lg" className={styles.ctaButton} disabled><XCircle size={20} /> Registration Closed</PlayfulButton>;
  };

  const { totalQuestions, durationMinutes, subject, examName } = liveTest.mockTestDetails;
  const topics = (subject ?? '')
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);

  const metaItems: Omit<React.ComponentProps<typeof DetailItem>, 'wide'>[] = [];
  if (totalQuestions > 0) {
    metaItems.push({ icon: <FileText size={18} />, tone: 'lavender', label: 'Questions', value: totalQuestions });
  }
  if (durationMinutes > 0) {
    metaItems.push({ icon: <Clock size={18} />, tone: 'blue', label: 'Duration', value: `${durationMinutes} mins` });
  }
  if (liveTest.startTime) {
    metaItems.push({ icon: <CalendarClock size={18} />, tone: 'sage', label: 'Starts', value: formatDay(liveTest.startTime), sub: formatTime(liveTest.startTime) });
  }
  metaItems.push({ icon: <Calendar size={18} />, tone: 'peach', label: 'Ends', value: formatDay(liveTest.endTime), sub: formatTime(liveTest.endTime) });
  if (liveTest.registrationDeadline) {
    metaItems.push({ icon: <Hourglass size={18} />, tone: 'yellow', label: 'Register by', value: formatDay(liveTest.registrationDeadline), sub: formatTime(liveTest.registrationDeadline) });
  }

  const prizes = [liveTest.firstPrize, liveTest.secondPrize, liveTest.thirdPrize]
    .map((amount, index) => ({ amount, rank: ['1st', '2nd', '3rd'][index] }))
    .filter((prize) => prize.amount > 0);
  const showPrizes = liveTest.hasPrizes && liveTest.totalPrizePool > 0;
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';

  return (
    <div className={`${styles.hero} ${className || ''}`}>
      <div className={styles.heroInner}>

        <div className={styles.leftColumn}>
          <div className={styles.head}>
            <AssetTopRow kind="live-test" handle={liveTest.slug} title={liveTest.title} className={styles.topRow} shareClassName={playfulButtonClass('soft', 'sm')}>
              <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                <Link to={LIVE_TESTS_PATH} className={styles.breadcrumbRoot}>Live Competitions</Link>
                <ChevronRight size={14} className={styles.breadcrumbChevron} aria-hidden="true" />
                <span className={styles.breadcrumbCurrent} title={liveTest.title}>{liveTest.title}</span>
              </nav>
            </AssetTopRow>

            <div className={styles.badgesRow}>
              <Badge className={`${styles.statusPill} ${styles[`status_${status}`]}`}>
                {status === 'live' && <span className={styles.liveDot} aria-hidden="true" />}
                {STATUS_LABELS[status]}
              </Badge>
              {examName && <Badge className={styles.examBadge}>{examName}</Badge>}
            </div>

            <h1 className={styles.title}>{liveTest.title}</h1>

            <p className={styles.creator}>
              <span className={styles.creatorBy}>By</span>
              <Avatar className={styles.creatorAvatar}>
                {liveTest.teacherProfile.avatarUrl && (
                  <AvatarImage src={liveTest.teacherProfile.avatarUrl} alt={liveTest.teacherProfile.name} />
                )}
                <AvatarFallback className={styles.creatorAvatarFallback}>{getInitials(liveTest.teacherProfile.name)}</AvatarFallback>
              </Avatar>
              <Link to={`/expert/${liveTest.teacherSlug}`} className={styles.creatorLink}>
                {liveTest.teacherProfile.name}
              </Link>
              <VerifiedBadge isVerified={liveTest.teacherIsVerified} size="sm" />
            </p>
          </div>

          {status === 'upcoming' && liveTest.startTime && <CountdownTimer target={liveTest.startTime} label="Test Starts In" />}
          {status === 'live' && <CountdownTimer target={liveTest.endTime} label="Test Ends In" />}

          <div className={styles.actionBlock}>
            {isTeacher ? (
              <div className={styles.teacherInfoBox}>
                <Info size={20} />
                <div className={styles.teacherInfoBoxContent}>
                  <strong>This live test is for students only.</strong>
                  <span>Teachers cannot participate in live tests.</span>
                </div>
              </div>
            ) : (
              <div className={styles.ctaContainer}>
                {renderCTA()}
              </div>
            )}

            <div className={styles.seats}>
              <div className={styles.seatsText}>
                <Users size={16} aria-hidden="true" />
                <span>
                  <strong>{liveTest.enrolledCount.toLocaleString()}</strong> / {liveTest.maxSeats.toLocaleString()} seats filled
                </span>
              </div>
              <Progress value={enrollmentPercentage} className={styles.progressBar} />
            </div>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.media}>
            <div className={styles.thumbnailFrame}>
              {liveTest.introVideoUrl ? (
                <VideoPreview
                  videoUrl={liveTest.introVideoUrl}
                  thumbnailUrl={liveTest.thumbnailUrl}
                  title={liveTest.title}
                  className={styles.thumbnailMedia}
                  inlinePlayback={true}
                />
              ) : (
                <img
                  src={liveTest.thumbnailUrl || Placeholder.LIVE}
                  alt={liveTest.title}
                  className={styles.thumbnailImage}
                />
              )}
            </div>
          </div>

          <div className={styles.details}>
            <div className={styles.detailsGrid}>
              {metaItems.map((item, index) => {
                const wide = index === metaItems.length - 1 && metaItems.length % 2 === 1;
                return (
                  <DetailItem
                    key={item.label}
                    {...item}
                    value={wide && item.sub ? `${item.value}, ${item.sub}` : item.value}
                    sub={wide ? undefined : item.sub}
                    wide={wide}
                  />
                );
              })}
              {topics.length > 0 && (
                <DetailItem
                  icon={<BookOpen size={18} />}
                  tone="sage"
                  label={topics.length > 1 ? 'Topics' : 'Subject'}
                  value={<TopicChips topics={topics} />}
                  wide
                />
              )}
              {showPrizes && (
                <DetailItem
                  icon={<Trophy size={18} />}
                  tone="yellow"
                  label="Prize pool"
                  value={formatCurrency(liveTest.totalPrizePool)}
                  sub={prizes.length > 0 && (
                    <span className={styles.prizeList}>
                      {prizes.map((prize) => (
                        <span key={prize.rank} className={styles.prizeChip}>
                          <Medal size={12} aria-hidden="true" />
                          {prize.rank} {formatCurrency(prize.amount)}
                        </span>
                      ))}
                    </span>
                  )}
                  wide
                />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
