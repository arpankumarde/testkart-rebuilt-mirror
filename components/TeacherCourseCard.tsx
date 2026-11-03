import React from 'react';
import { Link } from 'react-router-dom';
import {
  Edit,
  Trash2,
  Eye,
  Users,
  Layers,
  BookOpen,
  MoreVertical,
  Globe,
  AlertCircle,
  Share2,
  TrendingUp,
  Wrench,
  Gift,
  CalendarClock,
  CalendarX,
  Archive,
} from 'lucide-react';
import { TeacherRejectionNote } from './TeacherRejectionNote';
import { TeacherListingBadges } from './TeacherListingBadges';
import { performanceHref } from '../helpers/teacherPerformanceFormat';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { VideoPreview } from './VideoPreview';
import { ShareAssetDialog } from './ShareAssetDialog';
import { TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { formatLanguages } from '../helpers/itemLanguages';
import { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { useBundleUnpublishGuard } from '../helpers/useBundleUnpublishGuard';
import { courseDiscountPrice } from '../helpers/coursePricing';
import { formatRupees } from '../helpers/teacherCampaignRules';
import { getItemExamNames, summarizeExamNames } from '../helpers/itemExams';
import { expiryLastDay, formatExpiryDay, isExpired, isExpiringSoon } from '../helpers/contentExpiry';
import { Placeholder } from '../helpers/placeholderImages';
import styles from './TeacherCourseCard.module.css';

interface TeacherCourseCardProps {
  course: TeacherCourseListItem;
  onDelete: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
  /** The course's Creator Bonus state, from the teacher's bonus overview. */
  bonus?: { state: string; amount: number };
}

type CardStatus = 'published' | 'draft' | 'archived' | 'inReview' | 'rejected';

const STATUS_LABEL: Record<CardStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  inReview: 'In review',
  rejected: 'Rejected',
};

const bonusLabel = (bonus?: { state: string; amount: number }) => {
  if (!bonus) return null;
  if (bonus.state === 'ready') return `Bonus ready: ${formatRupees(bonus.amount)}`;
  if (bonus.state === 'claimed') return 'Bonus claimed';
  if (bonus.state === 'credited') return `${formatRupees(bonus.amount)} bonus earned`;
  return null;
};

const formatInr = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;

export const TeacherCourseCard: React.FC<TeacherCourseCardProps> = ({
  course,
  onDelete,
  onUnpublish,
  onArchive,
  bonus,
}) => {
  const { unpublishCourseMutation } = useTeacherCourseMutations();
  const [isShareOpen, setShareOpen] = React.useState(false);

  const { requestUnpublish, bundleUnpublishDialog } = useBundleUnpublishGuard();

  const handleUnpublish = () => {
    if (unpublishCourseMutation.isPending) return;
    void requestUnpublish({ itemType: 'course', ids: [course.id] }, async (confirmed) => {
      await unpublishCourseMutation.mutateAsync({
        courseId: course.id,
        confirmBundleUnpublish: confirmed || undefined,
      });
      onUnpublish?.();
    });
  };

  const status = course.status ?? 'draft';
  const isInReview = status !== 'published' && course.inReview;
  const rejection = status === 'draft' && !isInReview ? course.rejection : null;
  const cardStatus: CardStatus = isInReview
    ? 'inReview'
    : rejection
      ? 'rejected'
      : status === 'published' || status === 'archived'
        ? status
        : 'draft';
  const statusLabel = STATUS_LABEL[cardStatus];

  const expiry = { expiresAt: course.expiresAt ?? null, expiredAt: course.expiredAt ?? null };
  const expired = isExpired(expiry);
  const expiringSoon = !expired && isExpiringSoon(expiry);
  const expiryDay = expiry.expiresAt ? formatExpiryDay(expiryLastDay(expiry.expiresAt)) : null;

  const discountPrice = courseDiscountPrice(course.price, course.discountPrice);
  const effectivePrice = discountPrice ?? course.price;
  const exams = summarizeExamNames(getItemExamNames(course));
  const languages = formatLanguages(course);
  const plainDescription = course.description
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const bonusText = bonusLabel(bonus);
  const editPath = `/teacher/courses/${course.id}/edit`;
  const views = course.views ?? 0;
  const showResults = status !== 'draft';

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        <VideoPreview
          videoUrl={course.introVideoUrl || course.thumbnailUrl}
          thumbnailUrl={course.thumbnailImageUrl || Placeholder.COURSE}
          title={course.title}
          className={styles.thumbnail}
        />
        <span className={`${styles.status} ${styles[cardStatus]}`}>
          <span className={styles.statusDot} />
          {statusLabel}
        </span>
        {(expired || expiringSoon) && (
          <span
            className={`${styles.expiry} ${expired ? styles.expired : styles.expiringSoon}`}
            title={expired ? 'Expired: no longer on sale.' : `On sale until the end of ${expiryDay} (IST).`}
          >
            {expired ? <CalendarX size={12} aria-hidden="true" /> : <CalendarClock size={12} aria-hidden="true" />}
            {expired ? 'Expired' : 'Expiring soon'}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {exams.label && (
          <p className={styles.eyebrow} title={exams.fullList}>
            {exams.label}
          </p>
        )}
        <h3 className={styles.title}>
          <Link to={editPath} className={styles.titleLink}>
            {course.title}
          </Link>
          <span className={styles.srOnly}>
            , {statusLabel}
            {expired ? ', expired' : expiringSoon ? ', expiring soon' : ''}
          </span>
        </h3>
        {plainDescription ? <p className={styles.description}>{plainDescription}</p> : null}
        {!expired && (
          <TeacherListingBadges
            visibility={course.visibility}
            live={status === 'published'}
            inReview={course.inReview}
            rejected={!!course.rejection}
            expiresAt={null}
            expiredAt={null}
          />
        )}
        {rejection && <TeacherRejectionNote rejection={rejection} />}
        {bonusText && (
          <Link to="/teacher/creator-bonus" className={styles.bonus}>
            <Gift size={13} aria-hidden="true" />
            {bonusText}
          </Link>
        )}
      </div>

      <ul className={styles.stats}>
        <li>
          <BookOpen size={13} aria-hidden="true" />
          {plural(course.lessonsCount, 'lesson', 'lessons')}
        </li>
        <li>
          <Layers size={13} aria-hidden="true" />
          {plural(course.sectionsCount, 'section', 'sections')}
        </li>
        <li>
          <Eye size={13} aria-hidden="true" />
          {plural(views, 'view', 'views')}
        </li>
        {languages && (
          <li>
            <Globe size={13} aria-hidden="true" />
            {languages}
          </li>
        )}
        {expiryDay && !expired && (
          <li>
            <CalendarClock size={13} aria-hidden="true" />
            Until {expiryDay}
          </li>
        )}
      </ul>

      <div className={styles.footer}>
        <p className={styles.price}>
          {effectivePrice > 0 ? (
            <>
              {formatInr(effectivePrice)}
              {discountPrice !== null && <span className={styles.wasPrice}>{formatInr(course.price)}</span>}
            </>
          ) : (
            <span className={styles.free}>Free</span>
          )}
        </p>
        <div className={styles.actions}>
          <Link
            to={editPath}
            className={`${styles.editButton} ${rejection ? styles.fixButton : ''}`}
            aria-label={`${rejection ? 'Fix' : 'Edit'} ${course.title}`}
          >
            {rejection ? <Wrench size={14} aria-hidden="true" /> : <Edit size={14} aria-hidden="true" />}
            {rejection ? 'Fix it' : 'Edit'}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More actions for ${course.title}`}
                className={styles.iconButton}
              >
                <MoreVertical size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={editPath} className={styles.menuItem}>
                  <Edit size={16} />
                  <span>Edit course</span>
                </Link>
              </DropdownMenuItem>
              {status === 'published' && (
                <>
                  <DropdownMenuItem onClick={() => setShareOpen(true)} className={styles.menuItem}>
                    <Share2 size={16} />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/course/${course.slug}`} target="_blank" className={styles.menuItem}>
                      <Eye size={16} />
                      <span>View public page</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {showResults && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={performanceHref('courses', { course: course.id })} className={styles.menuItem}>
                      <TrendingUp size={16} />
                      <span>Progress</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={performanceHref('students', { course: course.id })} className={styles.menuItem}>
                      <Users size={16} />
                      <span>Students</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {status === 'published' && (
                <DropdownMenuItem onClick={handleUnpublish} className={styles.menuItem}>
                  <AlertCircle size={16} />
                  <span>Unpublish</span>
                </DropdownMenuItem>
              )}
              {status !== 'archived' && onArchive && (
                <DropdownMenuItem onClick={onArchive} className={styles.menuItem}>
                  <Archive size={16} />
                  <span>Archive</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className={`${styles.menuItem} ${styles.deleteItem}`}>
                <Trash2 size={16} />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {bundleUnpublishDialog}

      {status === 'published' && (
        <ShareAssetDialog
          open={isShareOpen}
          onOpenChange={setShareOpen}
          kind="course"
          handle={course.slug}
          campaign={TEACHER_CONSOLE_SHARE_CAMPAIGN}
          sharer="owner"
          title={course.title}
        />
      )}
    </article>
  );
};
