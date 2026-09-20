import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, BarChart2, Edit, Trash2, IndianRupee, Trophy, ListChecks, CheckCircle, XCircle, Share2, RefreshCw, Download, Loader2, EyeOff, Info } from 'lucide-react';
import * as Progress from '@radix-ui/react-progress';
import * as Dialog from '@radix-ui/react-dialog';
import { TeacherLiveTestItem } from '../endpoints/teacher/live-tests/list_GET.schema';
import { useCountdownTimer } from '../helpers/useCountdownTimer';
import { useDownloadTestPdf } from '../helpers/useDownloadTestPdf';
import { stripHtmlClient } from '../helpers/stripHtmlClient';
import { Button } from './Button';
import { Badge } from './Badge';
import { ShareAssetDialog } from './ShareAssetDialog';
import { TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { Placeholder } from '../helpers/placeholderImages';
import { useAuth } from '../helpers/useAuth';
import styles from './TeacherLiveTestCard.module.css';

interface TeacherLiveTestCardProps {
  liveTest: TeacherLiveTestItem;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onViewAnalytics: (id: number) => void;
  onContinueEditing?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onUnpublish?: (id: number) => void;
  className?: string;
}

const CountdownDisplay: React.FC<{ targetTime: Date; prefix: string }> = ({ targetTime, prefix }) => {
  const { days, hours, minutes, seconds, isComplete } = useCountdownTimer(targetTime);

  if (isComplete) {
    return null;
  }

  return (
    <div className={styles.countdown}>
      {prefix}:{' '}
      {days > 0 && `${days}d `}
      {hours > 0 && `${hours}h `}
      {minutes > 0 && `${minutes}m `}
      {seconds}s
    </div>
  );
};

export const TeacherLiveTestCard: React.FC<TeacherLiveTestCardProps> = ({
  liveTest,
  onEdit,
  onDelete,
  onViewAnalytics,
  onContinueEditing,
  onDuplicate,
  onUnpublish,
  className,
}) => {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setShareDialogOpen] = useState(false);
  const status = liveTest.status;
  const { mutate: downloadPdf, isPending: isDownloading } = useDownloadTestPdf();
  const { authState } = useAuth();
  // Team managers do not see the owner's revenue.
  const showRevenue = !(authState.type === 'authenticated' && authState.user.teacherRole === 'manager');

  const statusInfo = useMemo((): { text: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning'; className: string } => {
    switch (status) {
      case 'draft':
        return liveTest.inReview
          ? { text: 'In review', variant: 'warning', className: styles.draft }
          : { text: 'Draft', variant: 'secondary', className: styles.draft };
      case 'upcoming':
        return { text: 'Upcoming', variant: 'secondary', className: styles.upcoming };
      case 'live':
        return { text: 'Live Now', variant: 'destructive', className: styles.live };
      case 'ended':
        return { text: 'Ended', variant: 'outline', className: styles.ended };
      case 'registration_closed':
        return { text: 'Registration Closed', variant: 'warning', className: styles.closed };
      case 'seats_full':
        return { text: 'Seats Full', variant: 'warning', className: styles.full };
      default:
        return { text: 'Unknown', variant: 'outline', className: styles.ended };
    }
  }, [status, liveTest.inReview]);

  const enrollmentPercentage = liveTest.maxSeats > 0 ? (liveTest.enrolledCount / liveTest.maxSeats) * 100 : 0;
  const totalRevenue = liveTest.actualRevenue;
  const isFree = liveTest.price === 0;
  const hasEnded = status === 'ended';

  // Compute permissions once to avoid TypeScript narrowing issues in conditional branches
  const canEditDetails = status !== 'ended';
  const canEditQuestions = status === 'draft' || status === 'upcoming';
  const canDelete = status === 'draft' || (status === 'upcoming' && liveTest.enrolledCount === 0);
  const canUnpublish = (status === 'upcoming' || status === 'live') && liveTest.enrolledCount === 0;

  const formattedPrizePool = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(liveTest.totalPrizePool);

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <>
      <div className={`${styles.card} ${statusInfo.className} ${className || ''}`}>
        <div className={styles.thumbnailWrapper}>
          {liveTest.thumbnailUrl ? (
            <img
              src={liveTest.thumbnailUrl}
              alt={liveTest.title}
              className={styles.thumbnail}
            />
          ) : (
            <img
              src={Placeholder.LIVE}
              alt={liveTest.title}
              className={styles.thumbnail}
            />
          )}
          <Badge variant={statusInfo.variant} className={styles.statusBadge}>
            {statusInfo.text}
          </Badge>
        </div>

        <div className={styles.content}>
          <h3 className={styles.title}>{liveTest.title}</h3>
          <p className={styles.description}>{stripHtmlClient(liveTest.description)}</p>

          {status === 'draft' && (
            <div className={styles.draftNotice}>
              <Info size={14} className={styles.draftNoticeIcon} aria-hidden="true" />
              <span>
                {liveTest.inReview
                  ? 'In review. Students can see it and register once our team approves it.'
                  : 'This test is not yet visible to students. Submit it for review to make it available.'}
              </span>
            </div>
          )}

          <div className={styles.timeInfo}>
            {liveTest.startTime ? (
              <div className={styles.timeItem}>
                <span>Starts:</span> {formatDateTime(liveTest.startTime)}
              </div>
            ) : (
              <div className={styles.timeItem}>
                <span>Ends:</span> {formatDateTime(liveTest.endTime)}
              </div>
            )}
            {liveTest.startTime && (
              <div className={styles.timeItem}>
                <span>Ends:</span> {formatDateTime(liveTest.endTime)}
              </div>
            )}
          </div>

          {status === 'upcoming' && liveTest.startTime && <CountdownDisplay targetTime={liveTest.startTime} prefix="Starts in" />}
          {status === 'live' && <CountdownDisplay targetTime={liveTest.endTime} prefix="Ends in" />}
        </div>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statHeader}>
              <Users size={14} />
              <span>Enrollment</span>
            </div>
            <div className={styles.enrollment}>
              <span className={styles.enrollmentText}>
                {liveTest.enrolledCount} / {liveTest.maxSeats} seats filled
              </span>
              <Progress.Root className={styles.progressRoot} value={enrollmentPercentage}>
                <Progress.Indicator
                  className={styles.progressIndicator}
                  style={{ transform: `translateX(-${100 - enrollmentPercentage}%)` }}
                />
              </Progress.Root>
            </div>
          </div>
          {showRevenue && (
            <div className={styles.statItem}>
              <div className={styles.statHeader}>
                <IndianRupee size={14} />
                <span>Revenue</span>
              </div>
              {isFree && !hasEnded ? (
                <span className={styles.freeLabel}>Free</span>
              ) : hasEnded ? (
                <span className={styles.revenue}>
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 0,
                  }).format(totalRevenue)}
                </span>
              ) : (
                <div className={styles.pendingRevenue}>
                  <div className={styles.pendingRevenueAmount}>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      minimumFractionDigits: 0,
                    }).format(totalRevenue)}
                  </div>
                  <div className={styles.pendingRevenueNote}>
                    <CheckCircle size={11} />
                    <span>Added to wallet after test ends</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {liveTest.hasPrizes && liveTest.totalPrizePool > 0 && (
            <div className={styles.statItem}>
              <div className={styles.statHeader}>
                <Trophy size={14} />
                <span>Prize Pool</span>
              </div>
              <span className={styles.prizePool}>
                {formattedPrizePool}
              </span>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {status === 'draft' ? (
            <>
              <div className={styles.primaryActions}>
                <Button variant="outline" size="sm" onClick={() => onEdit(liveTest.id)} disabled={!canEditDetails}>
                  <Edit size={14} />
                  Edit Details
                </Button>
                {onContinueEditing ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onContinueEditing(liveTest.id)}
                    disabled={!canEditQuestions}
                  >
                    <ListChecks size={14} />
                    Manage Questions
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    disabled={!canEditQuestions}
                  >
                    <Link to={`/teacher/live-test/${liveTest.id}/questions`}>
                      <ListChecks size={14} />
                      Manage Questions
                    </Link>
                  </Button>
                )}
                {!liveTest.inReview && (
                  <Button
                    variant="primary"
                    size="sm"
                    asChild
                  >
                    <Link to={`/teacher/live-test/${liveTest.id}/questions`}>
                      Review & submit
                    </Link>
                  </Button>
                )}
              </div>
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => liveTest.firstTestItemId != null && downloadPdf({ testItemId: liveTest.firstTestItemId })}
                  title="Download PDF"
                  disabled={liveTest.firstTestItemId == null || isDownloading}
                >
                  {isDownloading ? <Loader2 size={16} className={styles.spinnerIcon} /> : <Download size={16} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  title="Delete Draft Test"
                  disabled={!canDelete}
                >
                  <Trash2 size={16} className={styles.deleteIcon} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.primaryActions}>
                <Button variant="outline" size="sm" onClick={() => onEdit(liveTest.id)} disabled={!canEditDetails}>
                  <Edit size={14} />
                  Edit Details
                </Button>
                {onContinueEditing ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onContinueEditing(liveTest.id)}
                    disabled={!canEditQuestions}
                  >
                    <ListChecks size={14} />
                    Manage Questions
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    disabled={!canEditQuestions}
                  >
                    <Link to={`/teacher/live-test/${liveTest.id}/questions`}>
                      <ListChecks size={14} />
                      Manage Questions
                    </Link>
                  </Button>
                )}
              </div>
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShareDialogOpen(true)}
                  title="Share"
                  aria-label={`Share ${liveTest.title}`}
                >
                  <Share2 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => liveTest.firstTestItemId != null && downloadPdf({ testItemId: liveTest.firstTestItemId })}
                  title="Download PDF"
                  disabled={liveTest.firstTestItemId == null || isDownloading}
                >
                  {isDownloading ? <Loader2 size={16} className={styles.spinnerIcon} /> : <Download size={16} />}
                </Button>
                {canUnpublish && onUnpublish && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onUnpublish(liveTest.id)}
                    title="Unpublish Test"
                  >
                    <EyeOff size={16} />
                  </Button>
                )}
                {status === 'ended' ? (
                  <>
                    {onDuplicate && (
                      <Button variant="outline" size="sm" onClick={() => onDuplicate(liveTest.id)} title="Re-publish Test">
                        <RefreshCw size={14} />
                        Re-publish
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onViewAnalytics(liveTest.id)} title="View Analytics">
                      <BarChart2 size={14} />
                      View Analytics
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="icon-sm" onClick={() => onViewAnalytics(liveTest.id)} title="View Analytics">
                    <BarChart2 size={16} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  title="Delete Test"
                  disabled={!canDelete}
                >
                  <Trash2 size={16} className={styles.deleteIcon} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drafts are not on the public site, so there is nothing to share. */}
      {status !== 'draft' && (
        <ShareAssetDialog
          open={isShareDialogOpen}
          onOpenChange={setShareDialogOpen}
          kind="live-test"
          handle={liveTest.id}
          campaign={TEACHER_CONSOLE_SHARE_CAMPAIGN}
          sharer="owner"
          title={liveTest.title}
        />
      )}

      <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.dialogContent}>
            <Dialog.Title className={styles.dialogTitle}>Confirm Deletion</Dialog.Title>
            <Dialog.Description className={styles.dialogDescription}>
              Are you sure you want to delete the live test "{liveTest.title}"? This action cannot be undone.
            </Dialog.Description>
            <div className={styles.dialogActions}>
              <Dialog.Close asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(liveTest.id);
                  setDeleteDialogOpen(false);
                }}
              >
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};