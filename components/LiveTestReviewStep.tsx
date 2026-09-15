import React from 'react';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { LiveTestFormValues } from '../helpers/liveTestCreationFormSchema';
import { getTotalPrizePool, sortPrizeTiers } from '../helpers/liveTestPrizeTiers';
import type { LiveTestEditableStep } from '../helpers/liveTestFormValues';
import { Button } from './Button';
import { Edit, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import styles from './LiveTestReviewStep.module.css';

export type LiveTestReviewEditableStep = LiveTestEditableStep;

interface LiveTestReviewStepProps {
  values: LiveTestFormValues;
  // Jumps back to a step; "storefront" also opens the Storefront section. Edit
  // and Fix links are omitted when no navigation is offered.
  onEditStep?: (step: LiveTestReviewEditableStep, section?: 'storefront') => void;
  // "edit" swaps the pre-create checklist for a one-line summary.
  mode?: 'create' | 'edit';
  // Read-only steps and fields (a published test) get no Edit or Fix links and
  // are left out of the optional checklist.
  lockedSteps?: LiveTestReviewEditableStep[];
  lockedFields?: string[];
}

type MissingItem = {
  label: string;
  name: string;
  field: string;
  step: LiveTestReviewEditableStep;
  storefront?: boolean;
};

const plainText = (html: string | null | undefined): string =>
  (html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim();

const buildMissingItems = (values: LiveTestFormValues): MissingItem[] => {
  const whatYouLearn = (values.whatYouLearn || []).filter((v) => v.trim() !== '');
  const requirements = (values.requirements || []).filter((v) => v.trim() !== '');
  const missing: MissingItem[] = [];

  if (plainText(values.description).length < 10) {
    missing.push({ label: 'Description is missing or too short', name: 'description', field: 'description', step: 'info' });
  }
  if (!values.examName) {
    missing.push({ label: 'No exam selected', name: 'exam', field: 'examName', step: 'info' });
  }
  if (!values.thumbnailUrl) {
    missing.push({ label: 'No thumbnail set', name: 'thumbnail', field: 'thumbnailUrl', step: 'info', storefront: true });
  }
  if (!values.introVideoUrl) {
    missing.push({ label: 'No intro video added', name: 'intro video', field: 'introVideoUrl', step: 'info', storefront: true });
  }
  if (whatYouLearn.length === 0) {
    missing.push({ label: "No \"What You'll Master\" points added", name: "what you'll master", field: 'whatYouLearn', step: 'info', storefront: true });
  }
  if (requirements.length === 0) {
    missing.push({ label: 'No requirements added', name: 'requirements', field: 'requirements', step: 'info', storefront: true });
  }
  if (values.hasPrizes && (!values.prizeTiers || values.prizeTiers.length === 0)) {
    missing.push({ label: 'Prizes are enabled but no rank ranges are configured', name: 'prize ranks', field: 'prizeTiers', step: 'prizes' });
  }
  if (!values.startTime) {
    missing.push({ label: 'No fixed start time - students can start anytime before the test ends', name: 'start time', field: 'startTime', step: 'schedule' });
  }
  if (!values.registrationDeadline) {
    missing.push({ label: 'No registration deadline - students can register until the test starts', name: 'registration deadline', field: 'registrationDeadline', step: 'schedule' });
  }

  return missing;
};

export const LiveTestReviewStep: React.FC<LiveTestReviewStepProps> = ({
  values,
  onEditStep,
  mode = 'create',
  lockedSteps = [],
  lockedFields = [],
}) => {
  const whatYouLearn = (values.whatYouLearn || []).filter((v) => v.trim() !== '');
  const requirements = (values.requirements || []).filter((v) => v.trim() !== '');
  const missingItems = buildMissingItems(values).filter(
    (item) => !lockedSteps.includes(item.step) && !lockedFields.includes(item.field)
  );
  const openItem = (item: MissingItem) => onEditStep?.(item.step, item.storefront ? 'storefront' : undefined);

  const renderSectionHeader = (title: string, step: LiveTestReviewEditableStep) => (
    <div className={styles.sectionHeader}>
      <h4>{title}</h4>
      {lockedSteps.includes(step) ? (
        <span className={styles.lockedLabel}>
          <Lock size={12} /> Locked
        </span>
      ) : (
        onEditStep && (
          <Button type="button" variant="outline" size="sm" onClick={() => onEditStep(step)}>
            <Edit size={14} /> Edit
          </Button>
        )
      )}
    </div>
  );

  const timingSummary = values.subjectWiseTiming
    ? 'Subject-wise timing'
    : values.questionWiseTiming
      ? 'Question-wise timing'
      : `${values.durationMinutes} minutes`;

  return (
    <div className={styles.reviewContainer}>
      {mode === 'create' ? (
        <>
          {onEditStep && (
            <p className={styles.reviewHint}>
              Double-check everything below. Use Edit on any section to go back and fill in or adjust details before
              creating.
            </p>
          )}
          {missingItems.length > 0 ? (
            <div className={styles.checklistBanner}>
              <div className={styles.checklistHeader}>
                <AlertTriangle size={16} className={styles.warningIcon} />
                <span>{missingItems.length} optional {missingItems.length === 1 ? 'item' : 'items'} still missing</span>
              </div>
              <ul className={styles.checklistList}>
                {missingItems.map((item) => (
                  <li key={item.field}>
                    <span>{item.label}</span>
                    {onEditStep && (
                      <button type="button" className={styles.checklistFix} onClick={() => openItem(item)}>
                        Fix
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.checklistBannerOk}>
              <CheckCircle2 size={16} />
              <span>All storefront and schedule details are filled in.</span>
            </div>
          )}
        </>
      ) : (
        missingItems.length > 0 && (
          <p className={styles.optionalSummary}>
            <span className={styles.optionalSummaryLabel}>Optional, not set:</span>{' '}
            {missingItems.map((item, index) => (
              <React.Fragment key={item.field}>
                {index > 0 && ', '}
                {onEditStep ? (
                  <button type="button" className={styles.checklistFix} onClick={() => openItem(item)}>
                    {item.name}
                  </button>
                ) : (
                  item.name
                )}
              </React.Fragment>
            ))}
          </p>
        )
      )}

      {renderSectionHeader('Test Details', 'info')}
      <p><strong>Title:</strong> {values.title}</p>
      <div className={styles.descriptionBlock}>
        <strong>Description:</strong>
        {plainText(values.description) || /<img\b/i.test(values.description ?? '') ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(values.description) }} />
        ) : (
          <span> Not set</span>
        )}
      </div>
      <p><strong>Exam:</strong> {values.examName || 'Not selected'}</p>
      <p><strong>Language:</strong> {values.language || 'Not specified'}</p>
      <p><strong>Duration:</strong> {timingSummary}</p>
      <p>
        <strong>Price:</strong>{' '}
        {values.isFree ? 'Free' : `₹${values.price.toLocaleString('en-IN')}`}
        {!values.isFree && values.discountPrice != null && (
          <> (discounted to ₹{values.discountPrice.toLocaleString('en-IN')})</>
        )}
      </p>
      <p><strong>Max Seats:</strong> {values.maxSeats}</p>
      <p><strong>Thumbnail:</strong> {values.thumbnailUrl ? values.thumbnailUrl : 'Not set'}</p>
      <div>
        <strong>What You'll Master:</strong>
        {whatYouLearn.length > 0 ? (
          <ul>
            {whatYouLearn.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        ) : (
          <span> Not set</span>
        )}
      </div>
      <div>
        <strong>Requirements:</strong>
        {requirements.length > 0 ? (
          <ul>
            {requirements.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        ) : (
          <span> Not set</span>
        )}
      </div>
      <hr />
      {renderSectionHeader('Schedule', 'schedule')}
      <p><strong>Registration Deadline:</strong> {values.registrationDeadline?.toLocaleString() || 'N/A'}</p>
      <p><strong>Start Time:</strong> {values.startTime?.toLocaleString() || 'N/A'}</p>
      <p><strong>End Time:</strong> {values.endTime?.toLocaleString() || 'N/A'}</p>
      <hr />
      {renderSectionHeader('Prizes', 'prizes')}
      {values.hasPrizes && values.prizeTiers && values.prizeTiers.length > 0 ? (
        <>
          <p><strong>Prize Pool (calculated):</strong> ₹{getTotalPrizePool(values.prizeTiers).toLocaleString('en-IN')}</p>
          <ul>
            {sortPrizeTiers(values.prizeTiers).map((tier, i) => (
              <li key={i}>
                {tier.rankFrom === tier.rankTo ? `Rank ${tier.rankFrom}` : `Ranks ${tier.rankFrom}-${tier.rankTo}`}:{' '}
                ₹{tier.amountPerRank.toLocaleString('en-IN')} each
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No prize money offered.</p>
      )}
    </div>
  );
};