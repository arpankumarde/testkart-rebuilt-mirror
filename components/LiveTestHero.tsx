import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../helpers/useAuth';
import { Clock, Users, Calendar, Zap, CheckCircle, XCircle, IndianRupee, PlayCircle, Info, ChevronRight, Eye, Share2, FileText, BookOpen, Trophy } from 'lucide-react';
import { useCountdownTimer } from '../helpers/useCountdownTimer';
import { getLiveTestStatus } from '../helpers/useLiveTestHelpers';
import { Placeholder } from '../helpers/placeholderImages';

import { VerifiedBadge } from './VerifiedBadge';
import { Button } from './Button';
import { Progress } from './Progress';
import { Badge } from './Badge';
import type { OutputType as LiveTestDetails } from '../endpoints/live-tests/details_GET.schema';
import { useLiveTestEnrollment } from '../helpers/useLiveTestEnrollment';
import { postLiveTestsPurchase } from '../endpoints/live-tests/purchase_POST.schema';
import { postPaymentPayuRedirect } from '../endpoints/payment/payu/redirect_POST.schema';
import { postPaymentPayuVerifyAndComplete } from '../endpoints/payment/payu/verify-and-complete_POST.schema';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { LIVE_TEST_DETAILS_QUERY_KEY_PREFIX } from '../helpers/useLiveTestDetailsQuery';
import { LIVE_TESTS_QUERY_KEY } from '../helpers/useLiveTestsQuery';
import { ShareAssetDialog } from './ShareAssetDialog';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { VideoPreview } from "./VideoPreview";
import styles from './LiveTestHero.module.css';

interface LiveTestHeroProps {
  liveTest: LiveTestDetails;
  className?: string;
}

const CountdownTimer: React.FC<{ target: Date; label: string }> = ({ target, label }) => {
  const { days, hours, minutes, seconds, isComplete } = useCountdownTimer(target);

  if (isComplete) {
    return null;
  }

  return (
    <div className={styles.countdown}>
      <div className={styles.countdownLabel}>{label}</div>
      <div className={styles.countdownTimer}>
        <div className={styles.timerBlock}><span>{String(days).padStart(2, '0')}</span><small>Days</small></div>
        <div className={styles.timerSeparator}>:</div>
        <div className={styles.timerBlock}><span>{String(hours).padStart(2, '0')}</span><small>Hours</small></div>
        <div className={styles.timerSeparator}>:</div>
        <div className={styles.timerBlock}><span>{String(minutes).padStart(2, '0')}</span><small>Mins</small></div>
        <div className={styles.timerSeparator}>:</div>
        <div className={styles.timerBlock}><span>{String(seconds).padStart(2, '0')}</span><small>Secs</small></div>
      </div>
    </div>
  );
};

export const LiveTestHero: React.FC<LiveTestHeroProps> = ({ liveTest, className }) => {
  const status = getLiveTestStatus(liveTest);
  const isFree = liveTest.price === 0;
  const enrollmentPercentage = (liveTest.enrolledCount / liveTest.maxSeats) * 100;
  const enrollmentMutation = useLiveTestEnrollment();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
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
            queryClient.invalidateQueries({
              queryKey: [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, liveTest.id],
              exact: false,
            });
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
        <Button size="lg" className={styles.ctaButton} disabled>
          <XCircle size={20} /> Test Ended
        </Button>
      );
    }
    
        const now = new Date();
    const hasExpired = now > new Date(liveTest.endTime);
    
    if (status === 'live' && liveTest.isEnrolled) {
      if (liveTest.hasAttempted) {
        return (
          <Button size="lg" className={styles.ctaButton} disabled>
            <CheckCircle size={20} /> Already Attempted
          </Button>
        );
      }
      if (hasExpired) {
        return (
          <Button size="lg" className={styles.ctaButton} disabled>
            <XCircle size={20} /> Test Ended
          </Button>
        );
      }
      return (
        <Button 
          size="lg" 
          variant="primary"
          className={styles.ctaButton}
          onClick={() => navigate(`/live-portal/${liveTest.id}`)}
          disabled={enrollmentMutation.isPending}
        >
          <PlayCircle size={20} /> {enrollmentMutation.isPending ? 'Loading...' : 'Start Test'}
        </Button>
      );
    }
    if (status === 'registration_closed' && liveTest.isEnrolled) {
      if (liveTest.startTime) {
        return (
          <Button size="lg" className={styles.ctaButton} disabled>
            <Clock size={20} /> Test starts in: {formatInlineCountdown(startCountdown)}
          </Button>
        );
      }
      return (
        <Button size="lg" className={styles.ctaButton} disabled>
          <Clock size={20} /> Waiting for test to begin
        </Button>
      );
    }
    if (liveTest.canEnroll) {
      if (isFree) {
        return (
          <Button 
            size="lg" 
            className={styles.ctaButton}
            onClick={handleFreeEnroll}
            disabled={enrollmentMutation.isPending || isVerifyingPayment}
          >
            {enrollmentMutation.isPending ? 'Enrolling...' : isVerifyingPayment ? 'Verifying...' : 'Enroll for Free'}
          </Button>
        );
      } else {
        return (
          <Button 
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
                  <IndianRupee size={18} strokeWidth={2.5} />
                  {liveTest.price}
                </span>
              </>
            )}
          </Button>
        );
      }
    }
    if (liveTest.isEnrolled) {
      if (hasExpired) {
        return <Button size="lg" className={styles.ctaButton} disabled><XCircle size={20} /> Test Ended</Button>;
      }
      return <Button size="lg" className={styles.ctaButton} disabled><CheckCircle size={20} /> Enrolled</Button>;
    }
    return <Button size="lg" className={styles.ctaButton} disabled><XCircle size={20} /> Registration Closed</Button>;
  };

  const formatDate = (date: Date | string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const statusClassSuffix = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const heroClass = `${styles.hero} ${styles[`status${statusClassSuffix}`] || ''} ${className || ''}`;

  return (
    <div className={heroClass}>
      <div className={styles.heroInner}>
        
        {/* Left Column */}
        <div className={styles.leftColumn}>
          <nav className={styles.breadcrumb}>
            <Link to="/mock-test/live">Live Competitions</Link>
            <ChevronRight size={14} />
            <span>{liveTest.title}</span>
          </nav>
          
          <div className={styles.badgesRow}>
            {status === 'live' && <Badge variant="destructive" className={styles.liveBadge}><Zap size={14} /> LIVE NOW</Badge>}
            {liveTest.mockTestDetails?.examName && <Badge variant="secondary">{liveTest.mockTestDetails.examName}</Badge>}
          </div>
          
          <h1 className={styles.title}>{liveTest.title}</h1>
          
          <div className={styles.creatorViewsContainer}>
            <p className={styles.creator}>
              By:{' '}
              <Link to={`/expert/${liveTest.teacherSlug}`} className={styles.creatorLink}>
                {liveTest.teacherProfile.name}
              </Link>{' '}
              <VerifiedBadge isVerified={liveTest.teacherIsVerified} size="sm" />
            </p>
            <span className={styles.viewCount}>
              <Eye size={16} /> {liveTest.viewCount.toLocaleString('en-IN')} views
            </span>
          </div>

          {status === 'upcoming' && liveTest.startTime && <CountdownTimer target={liveTest.startTime} label="Test Starts In" />}
          {status === 'live' && <CountdownTimer target={liveTest.endTime} label="Test Ends In" />}

          <div className={styles.metaPills}>
            {liveTest.startTime && (
              <div className={styles.metaPill}><Calendar size={16} /> <strong>Starts:</strong> {formatDate(liveTest.startTime)}</div>
            )}
            <div className={styles.metaPill}><Calendar size={16} /> <strong>Ends:</strong> {formatDate(liveTest.endTime)}</div>
            {liveTest.registrationDeadline && (
              <div className={styles.metaPill}><Clock size={16} /> <strong>Register by:</strong> {formatDate(liveTest.registrationDeadline)}</div>
            )}
          </div>

          <div className={styles.enrollmentSection}>
            <div className={styles.seats}>
              <Users size={20} />
              <span>{liveTest.enrolledCount.toLocaleString()} / {liveTest.maxSeats.toLocaleString()} seats filled</span>
            </div>
            <Progress value={enrollmentPercentage} className={styles.progressBar} />
          </div>

          {authState.type === 'authenticated' && authState.user.role === 'teacher' ? (
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

          <Button 
            variant="outline" 
            size="lg" 
            className={styles.shareButton}
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={18} />
            Share this live test
          </Button>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          <div className={styles.thumbnailContainer}>
            {liveTest.introVideoUrl ? (
              <VideoPreview
                videoUrl={liveTest.introVideoUrl}
                thumbnailUrl={liveTest.thumbnailUrl}
                title={liveTest.title}
                className={styles.thumbnailMedia}
                inlinePlayback={true}
              />
            ) : liveTest.thumbnailUrl ? (
              <img 
                src={liveTest.thumbnailUrl || undefined} 
                alt={liveTest.title} 
                className={styles.thumbnailImage} 
              />
            ) : (
              <img
                src={Placeholder.LIVE}
                alt={liveTest.title}
                className={styles.thumbnailImage}
              />
            )}
          </div>

          <div className={styles.quickStatsCard}>
            <div className={styles.quickStat}>
              <FileText size={20} /> 
              <span><strong>{liveTest.mockTestDetails.totalQuestions}</strong> Qs</span>
            </div>
            <div className={styles.quickStat}>
              <Clock size={20} /> 
              <span><strong>{liveTest.mockTestDetails.durationMinutes}</strong> mins</span>
            </div>
            <div className={styles.quickStat}>
              <BookOpen size={20} /> 
              <span><strong>{liveTest.mockTestDetails.subject || 'General'}</strong></span>
            </div>
          </div>

          {liveTest.hasPrizes && liveTest.totalPrizePool > 0 && (
            <div className={styles.compactPrizeCard}>
              <div className={styles.compactPrizeHeader}>
                <Trophy size={18} className={styles.trophyIcon} />
                <span>Prize Pool: <strong>{formatCurrency(liveTest.totalPrizePool)}</strong></span>
              </div>
              <div className={styles.compactPrizeList}>
                <span className={styles.compactPrizeItem}>🥇 {formatCurrency(liveTest.firstPrize)}</span>
                <span className={styles.compactPrizeItem}>🥈 {formatCurrency(liveTest.secondPrize)}</span>
                <span className={styles.compactPrizeItem}>🥉 {formatCurrency(liveTest.thirdPrize)}</span>
              </div>
            </div>
          )}
        </div>

      </div>

      <ShareAssetDialog
        open={isShareOpen}
        onOpenChange={setShareOpen}
        kind="live-test"
        handle={liveTest.id}
        title={liveTest.title}
        campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
      />
    </div>
  );
};