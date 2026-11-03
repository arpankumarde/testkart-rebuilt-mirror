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
  Trophy,
  Upload,
  Wrench,
} from 'lucide-react';
import { TeacherTest } from '../endpoints/teacher/tests/list_GET.schema';
import { Button } from './Button';
import { TeacherRejectionNote } from './TeacherRejectionNote';
import { TeacherListingBadges } from './TeacherListingBadges';
import { performanceHref } from '../helpers/teacherPerformanceFormat';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';
import { usePublishesWithoutReview } from '../helpers/usePublishesWithoutReview';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { ShareAssetDialog } from './ShareAssetDialog';
import { buildPublicAssetUrl, TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { getItemExamNames, summarizeExamNames } from '../helpers/itemExams';
import { Placeholder } from '../helpers/placeholderImages';
import styles from './TeacherTestCard.module.css';

interface TeacherTestCardProps {
  test: TeacherTest;
  onDelete: () => void;
  onUnpublish: () => void;
  onConvertToDraft?: () => void;
  className?: string;
}

const priceOf = (test: TeacherTest): number | null => {
  if (test.isFree) return null;
  const price = Number(test.discountPrice ?? test.price);
  return price ? price : null;
};

const formatRupees = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/* A generated placeholder-service URL is not a real cover, so it gets the default. */
const coverUrl = (thumbnailUrl: string | null) =>
  thumbnailUrl && !/placehold\.co|placeholder\.com|via\.placeholder/i.test(thumbnailUrl)
    ? thumbnailUrl
    : Placeholder.TEST;

/* `subject` is saved either as plain text or as a JSON array string ("[]", '["Physics"]'). */
const subjectLabel = (value: string | null): string | null => {
  const raw = value?.trim() ?? '';
  if (!raw) return null;
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const names = parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
        return names.length ? names.map((name) => name.trim()).join(', ') : null;
      }
    } catch {
      return null;
    }
  }
  return raw;
};

/* Descriptions may be saved as rich text; the card only needs the words. */
const plainText = (value: string | null) =>
  (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const TeacherTestCard: React.FC<TeacherTestCardProps> = ({
  test,
  onDelete,
  onUnpublish,
  onConvertToDraft,
  className,
}) => {
  const [isShareOpen, setShareOpen] = React.useState(false);
  const [coverFailed, setCoverFailed] = React.useState(false);
  // Toasts its own success and error and refreshes the list, so the card
  // moves to In review (or Published, for a verified teacher) once it lands.
  const publishMutation = useTeacherTestMutations().usePublishTestMutation();
  const publishesDirectly = usePublishesWithoutReview();
  const testUrl = buildPublicAssetUrl('test-series', test.slug);

  const isPublished = test.isPublished;
  const hasEnrollments = test.studentsEnrolled > 0;
  // Only drafts can be deleted outright; a published series with students has
  // to be unpublished, and one without them can drop back to draft first.
  const canDelete = !isPublished;
  const canConvertToDraft = isPublished && !hasEnrollments;
  const canUnpublish = isPublished && hasEnrollments;
  const showResults = isPublished || test.wasEverPublished || hasEnrollments;

  const isInReview = !isPublished && test.inReview;
  const rejection = !isPublished && !isInReview ? test.rejection : null;
  const status = isPublished
    ? 'published'
    : isInReview
      ? 'inReview'
      : rejection
        ? 'rejected'
        : test.wasEverPublished
          ? 'unpublished'
          : 'draft';
  const statusLabel = {
    published: 'Published',
    inReview: 'In review',
    rejected: 'Rejected',
    unpublished: 'Unpublished',
    draft: 'Draft',
  }[status];

  const price = priceOf(test);
  const discounted =
    price !== null && test.discountPrice != null && Number(test.discountPrice) < Number(test.price);
  const exams = summarizeExamNames(
    getItemExamNames(test).filter((name) => name.toLowerCase() !== 'unspecified')
  );
  const subject = subjectLabel(test.subject);
  const eyebrow = [exams.label, subject].filter(Boolean).join(' · ');
  const description = plainText(test.description);
  const editPath = `/teacher/test/${test.id}/edit`;
  const views = test.views ?? 0;
  const hasManageItems =
    canUnpublish || (canConvertToDraft && !!onConvertToDraft) || status === 'unpublished' || canDelete;

  const stats = [
    { icon: FileText, value: test.testItemsCount, one: 'test', many: 'tests' },
    { icon: Users, value: test.studentsEnrolled, one: 'student', many: 'students' },
    { icon: Eye, value: views, one: 'view', many: 'views' },
  ];

  return (
    <article className={`${styles.card} ${className || ''}`}>
      <Link to={editPath} className={styles.cover} tabIndex={-1} aria-hidden="true">
        <img
          src={coverFailed ? Placeholder.TEST : coverUrl(test.thumbnailUrl)}
          alt=""
          className={styles.thumbnail}
          loading="lazy"
          onError={() => setCoverFailed(true)}
        />
        <span className={`${styles.status} ${styles[status]}`}>
          <span className={styles.statusDot} />
          {statusLabel}
        </span>
      </Link>

      <div className={styles.body}>
        {eyebrow && (
          <p className={styles.eyebrow} title={exams.fullList || undefined}>
            {eyebrow}
          </p>
        )}
        <h3 className={styles.title}>
          <Link to={editPath} className={styles.titleLink}>
            {test.title}
          </Link>
          {/* The badge on the cover sits in a link hidden from screen readers. */}
          <span className={styles.srOnly}>, {statusLabel}</span>
        </h3>
        {description && <p className={styles.description}>{description}</p>}
        <TeacherListingBadges
          visibility={test.visibility}
          live={isPublished}
          inReview={test.inReview}
          rejected={!!test.rejection}
          expiresAt={test.expiresAt}
          expiredAt={test.expiredAt}
        />
        {rejection && <TeacherRejectionNote rejection={rejection} />}
      </div>

      <ul className={styles.stats}>
        {stats.map(({ icon: Icon, value, one, many }) => (
          <li key={one}>
            <Icon size={13} aria-hidden="true" />
            <strong>{value.toLocaleString('en-IN')}</strong>
            {plural(value, one, many)}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <p className={styles.price}>
          {price === null ? (
            <span className={styles.free}>Free</span>
          ) : (
            <>
              {formatRupees(price)}
              {discounted && <span className={styles.wasPrice}>{formatRupees(Number(test.price))}</span>}
            </>
          )}
        </p>

        <div className={styles.actions}>
          <Link
            to={editPath}
            className={`${styles.editButton} ${rejection ? styles.fixButton : ''}`}
            aria-label={`${rejection ? 'Fix' : 'Edit'} ${test.title}`}
          >
            {rejection ? <Wrench size={14} aria-hidden="true" /> : <Edit size={14} aria-hidden="true" />}
            {rejection ? 'Fix it' : 'Edit'}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More actions for ${test.title}`}
                className={styles.iconButton}
              >
                <MoreVertical size={16} aria-hidden="true" />
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
                      <span className={styles.srOnly}> (opens in a new tab)</span>
                    </a>
                  </DropdownMenuItem>
                  {(showResults || hasManageItems) && <DropdownMenuSeparator />}
                </>
              )}
              {showResults && (
                <>
                  <DropdownMenuItem asChild className={styles.menuItem}>
                    <Link to={performanceHref('leaderboards', { series: test.id })}>
                      <Trophy size={16} />
                      <span>Leaderboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={styles.menuItem}>
                    <Link to={performanceHref('students', { series: test.id })}>
                      <Users size={16} />
                      <span>Students</span>
                    </Link>
                  </DropdownMenuItem>
                  {hasManageItems && <DropdownMenuSeparator />}
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
                  <span>Unpublish</span>
                </DropdownMenuItem>
              )}
              {status === 'unpublished' && (
                <DropdownMenuItem
                  onSelect={() => publishMutation.mutate({ testId: test.id })}
                  disabled={publishMutation.isPending}
                  className={styles.menuItem}
                >
                  <Upload size={16} />
                  <span>
                    {publishesDirectly
                      ? (publishMutation.isPending ? 'Publishing...' : 'Publish')
                      : (publishMutation.isPending ? 'Submitting...' : 'Submit for review')}
                  </span>
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
