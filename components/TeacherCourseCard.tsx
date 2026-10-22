import React from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Eye, Users, Layers, BookOpen, MoreVertical, Globe, AlertCircle, Share2, TrendingUp, Wrench, Gift } from 'lucide-react';
import { TeacherCardInsights } from './TeacherCardInsights';
import { TeacherRejectionNote } from './TeacherRejectionNote';
import { UnlistedBadge } from './UnlistedBadge';
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
import styles from './TeacherCourseCard.module.css';

interface TeacherCourseCardProps {
  course: TeacherCourseListItem;
  onDelete: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
  /** The course's Creator Bonus state, from the teacher's bonus overview. */
  bonus?: { state: string; amount: number };
}

const STATUS_CLASS: Record<string, string> = {
  published: styles.published,
  draft: styles.draft,
  archived: styles.archived,
};

const bonusLabel = (bonus?: { state: string; amount: number }) => {
  if (!bonus) return null;
  if (bonus.state === 'ready') return `Bonus ready: ${formatRupees(bonus.amount)}`;
  if (bonus.state === 'claimed') return 'Bonus claimed';
  if (bonus.state === 'credited') return `${formatRupees(bonus.amount)} bonus earned`;
  return null;
};

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
  const statusClass = isInReview
    ? styles.inReview
    : rejection
      ? styles.rejected
      : STATUS_CLASS[status] ?? styles.draft;
  const statusText = isInReview ? 'in review' : rejection ? 'rejected' : status;

  const formatInr = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  const discountPrice = courseDiscountPrice(course.price, course.discountPrice);
  const formattedPrice = formatInr(discountPrice ?? course.price);

  const plainDescription = course.description
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const bonusText = bonusLabel(bonus);

  return (
    <div className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        <VideoPreview
          videoUrl={course.introVideoUrl || course.thumbnailUrl}
          thumbnailUrl={course.thumbnailImageUrl}
          title={course.title}
          className={styles.thumbnail}
        />
        <span className={`${styles.status} ${statusClass}`}>{statusText}</span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>
          <Link to={`/teacher/courses/${course.id}/edit`} className={styles.titleLink}>
            {course.title}
          </Link>
        </h3>
        {course.visibility === 'unlisted' && (
          <UnlistedBadge live={status === 'published'} inReview={course.inReview} rejected={!!course.rejection} />
        )}
        {plainDescription ? <p className={styles.description}>{plainDescription}</p> : null}

        <div className={styles.stats}>
          <div className={styles.stat}>
            <BookOpen size={14} />
            <span>{course.lessonsCount} {course.lessonsCount === 1 ? 'lesson' : 'lessons'}</span>
          </div>
          <div className={styles.stat}>
            <Layers size={14} />
            <span>{course.sectionsCount} {course.sectionsCount === 1 ? 'section' : 'sections'}</span>
          </div>
          <div className={styles.stat}>
            <Eye size={14} />
            <span>{course.views ?? 0} views</span>
          </div>
          {formatLanguages(course) && (
            <div className={styles.stat}>
              <Globe size={14} />
              <span>{formatLanguages(course)}</span>
            </div>
          )}
        </div>

        {rejection && <TeacherRejectionNote rejection={rejection} />}
        {bonusText && (
          <Link to="/teacher/creator-bonus" className={styles.bonus}>
            <Gift size={13} aria-hidden="true" />
            {bonusText}
          </Link>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.price}>
          {formattedPrice}
          {discountPrice !== null && <span className={styles.wasPrice}>{formatInr(course.price)}</span>}
        </p>
        <div className={styles.actions}>
          {status === 'published' && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShareOpen(true)}
              title="Share"
              aria-label={`Share ${course.title}`}
            >
              <Share2 size={16} />
            </Button>
          )}

          <Button asChild size="sm" variant={rejection ? 'primary' : 'outline'}>
            <Link to={`/teacher/courses/${course.id}/edit`}>
              {rejection ? <Wrench size={14} /> : <Edit size={14} />}
              {rejection ? 'Fix it' : 'Edit'}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${course.title}`}>
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/teacher/courses/${course.id}/edit`} className={styles.menuItem}>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleUnpublish} className={styles.unpublishItem}>
                    <AlertCircle size={16} />
                    <span>Unpublish</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {status !== 'archived' && onArchive && (
                <DropdownMenuItem onClick={onArchive} className={styles.menuItem}>
                  <Trash2 size={16} />
                  <span>Archive</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className={styles.deleteItem}>
                <Trash2 size={16} />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {status !== 'draft' && (
        <TeacherCardInsights
          itemTitle={course.title}
          items={[
            { to: performanceHref('courses', { course: course.id }), label: 'Progress', icon: TrendingUp },
            { to: performanceHref('students', { course: course.id }), label: 'Students', icon: Users },
          ]}
        />
      )}

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
    </div>
  );
};
