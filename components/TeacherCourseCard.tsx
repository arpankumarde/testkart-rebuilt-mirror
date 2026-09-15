import React from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Eye, Users, BookOpen, MoreVertical, Globe, AlertCircle, Share2 } from 'lucide-react';
import { Badge } from './Badge';
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
import { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import styles from './TeacherCourseCard.module.css';

interface TeacherCourseCardProps {
  course: TeacherCourseListItem;
  onDelete: () => void;
  onUnpublish?: () => void;
  onArchive?: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  published: styles.published,
  draft: styles.draft,
  archived: styles.archived,
};

export const TeacherCourseCard: React.FC<TeacherCourseCardProps> = ({
  course,
  onDelete,
  onUnpublish,
  onArchive,
}) => {
  const { unpublishCourseMutation } = useTeacherCourseMutations();
  const [isShareOpen, setShareOpen] = React.useState(false);

  const handleUnpublish = () => {
    unpublishCourseMutation.mutate(
      { courseId: course.id },
      {
        onSuccess: () => {
          onUnpublish?.();
        },
      }
    );
  };

  const status = course.status ?? 'draft';

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(course.price);

  const plainDescription = course.description
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        <VideoPreview
          videoUrl={course.introVideoUrl || course.thumbnailUrl}
          thumbnailUrl={course.thumbnailImageUrl}
          title={course.title}
          className={styles.thumbnail}
        />
        <span className={`${styles.status} ${STATUS_CLASS[status] ?? styles.draft}`}>{status}</span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>
          <Link to={`/teacher/courses/${course.id}/edit`} className={styles.titleLink}>
            {course.title}
          </Link>
        </h3>
        {plainDescription ? <p className={styles.description}>{plainDescription}</p> : null}

        {course.category && (
          <Badge variant="outline" className={styles.categoryBadge}>
            {course.category}
          </Badge>
        )}

        <div className={styles.stats}>
          <div className={styles.stat}>
            <BookOpen size={14} />
            <span>{course.lessonsCount} lessons</span>
          </div>
          <div className={styles.stat}>
            <Users size={14} />
            <span>{course.sectionsCount} sections</span>
          </div>
          <div className={styles.stat}>
            <Eye size={14} />
            <span>{course.views ?? 0} views</span>
          </div>
          {course.language && (
            <div className={styles.stat}>
              <Globe size={14} />
              <span>{course.language}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <p className={styles.price}>{formattedPrice}</p>
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

          <Button asChild size="sm" variant="outline">
            <Link to={`/teacher/courses/${course.id}/edit`}>
              <Edit size={14} />
              Edit
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
