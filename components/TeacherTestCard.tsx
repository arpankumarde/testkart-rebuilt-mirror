import React from 'react';
import { Link } from 'react-router-dom';
import {
  Edit,
  Trash2,
  Eye,
  Users,
  FileText,
  EyeOff,
  ArchiveRestore,
  ExternalLink,
  Share2,
  MoreVertical,
} from 'lucide-react';
import { TeacherTest } from '../endpoints/teacher/tests/list_GET.schema';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { ShareAssetDialog } from './ShareAssetDialog';
import { buildPublicAssetUrl, TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { Placeholder } from '../helpers/placeholderImages';
import styles from './TeacherTestCard.module.css';

interface TeacherTestCardProps {
  test: TeacherTest;
  onDelete: () => void;
  onUnpublish: () => void;
  onConvertToDraft?: () => void;
  className?: string;
}

const formatPrice = (test: TeacherTest) => {
  if (test.isFree) return 'Free';
  const price = Number(test.discountPrice ?? test.price);
  if (!price) return 'Free';
  return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const TeacherTestCard: React.FC<TeacherTestCardProps> = ({
  test,
  onDelete,
  onUnpublish,
  onConvertToDraft,
  className,
}) => {
  const [isShareOpen, setShareOpen] = React.useState(false);
  const testUrl = buildPublicAssetUrl('test-series', test.slug);

  const isPublished = test.isPublished;
  const hasEnrollments = test.studentsEnrolled > 0;
  // Only drafts can be deleted outright; a published series with students has
  // to be unpublished, and one without them can drop back to draft first.
  const canDelete = !isPublished;
  const canConvertToDraft = isPublished && !hasEnrollments;
  const canUnpublish = isPublished && hasEnrollments;

  const status = isPublished ? 'live' : test.wasEverPublished ? 'unpublished' : 'draft';
  const statusLabel = isPublished ? 'Live' : test.wasEverPublished ? 'Unpublished' : 'Draft';
  const discounted = !test.isFree && test.discountPrice != null && Number(test.discountPrice) < Number(test.price);

  return (
    <article className={`${styles.card} ${className || ''}`}>
      <Link to={`/teacher/test/${test.id}/edit`} className={styles.thumbnailLink} tabIndex={-1} aria-hidden="true">
        <img
          src={test.thumbnailUrl || Placeholder.TEST}
          alt=""
          className={styles.thumbnail}
          loading="lazy"
        />
        <span className={`${styles.status} ${styles[status]}`}>{statusLabel}</span>
      </Link>

      <div className={styles.content}>
        <h3 className={styles.title}>
          <Link to={`/teacher/test/${test.id}/edit`} className={styles.titleLink}>
            {test.title}
          </Link>
        </h3>

        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <FileText size={14} aria-hidden="true" />
            <dt className={styles.metaLabel}>Tests</dt>
            <dd className={styles.metaValue}>{test.testItemsCount}</dd>
          </div>
          <div className={styles.metaItem}>
            <Users size={14} aria-hidden="true" />
            <dt className={styles.metaLabel}>Students</dt>
            <dd className={styles.metaValue}>{test.studentsEnrolled}</dd>
          </div>
          <div className={styles.metaItem}>
            <Eye size={14} aria-hidden="true" />
            <dt className={styles.metaLabel}>Views</dt>
            <dd className={styles.metaValue}>{test.views ?? 0}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.footer}>
        <p className={styles.price}>
          {formatPrice(test)}
          {discounted && <span className={styles.wasPrice}>₹{Number(test.price).toLocaleString('en-IN')}</span>}
        </p>

        <div className={styles.actions}>
          {isPublished && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareOpen(true)}
              title="Share"
              aria-label={`Share ${test.title}`}
            >
              <Share2 size={16} />
            </Button>
          )}

          <Button asChild variant="outline" size="sm">
            <Link to={`/teacher/test/${test.id}/edit`}>
              <Edit size={14} />
              Edit
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`More actions for ${test.title}`}>
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPublished && (
                <>
                  <DropdownMenuItem onSelect={() => setShareOpen(true)} className={styles.menuItem}>
                    <Share2 size={16} />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={styles.menuItem}>
                    <a href={testUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      <span>View public page</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {canUnpublish && (
                <DropdownMenuItem onSelect={onUnpublish} className={styles.menuItem}>
                  <EyeOff size={16} />
                  <span>Unpublish</span>
                </DropdownMenuItem>
              )}
              {canConvertToDraft && onConvertToDraft && (
                <DropdownMenuItem onSelect={onConvertToDraft} className={styles.menuItem}>
                  <ArchiveRestore size={16} />
                  <span>Move to drafts</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onSelect={onDelete} className={`${styles.menuItem} ${styles.destructive}`}>
                  <Trash2 size={16} />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPublished && (
        <ShareAssetDialog
          open={isShareOpen}
          onOpenChange={setShareOpen}
          kind="test-series"
          handle={test.slug}
          campaign={TEACHER_CONSOLE_SHARE_CAMPAIGN}
          sharer="owner"
          title={test.title}
        />
      )}
    </article>
  );
};
