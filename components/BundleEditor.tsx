import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { TeacherFlowTop } from './TeacherFlowTop';
import { BundleForm, BundleFormValues, bundleFlowSteps } from './BundleForm';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useTeacherBundleDetailsQuery } from '../helpers/useTeacherBundleDetailsQuery';
import styles from './BundleEditor.module.css';

interface BundleEditorProps {
  bundleId: number | undefined;
  /** Where Cancel goes; the admin edit page also returns there after a save. */
  exitTo: string;
  exitLabel: string;
  /** Teacher page: the guided form with the step track and a Publish button. */
  guided?: boolean;
  /** Guided only: shown under the step track, e.g. the rejection note. */
  intro?: React.ReactNode;
}

/*
 * Loads a saved bundle into BundleForm and saves it. Shared by the teacher and
 * admin edit pages. Teachers stay on the page after saving, and publish a draft
 * from the form's own Publish button, which saves any changes first.
 */
export const BundleEditor = ({ bundleId, exitTo, exitLabel, guided = false, intro }: BundleEditorProps) => {
  const navigate = useNavigate();
  const { data: bundle, isLoading, isError, refetch, isFetching } = useTeacherBundleDetailsQuery(bundleId);
  const { updateBundleMutation, publishBundleMutation } = useBundleMutations();
  const [savedAt, setSavedAt] = useState(0);
  const isAdminEdit = exitTo.startsWith('/admin');

  const save = (values: BundleFormValues, onSaved: () => void) => {
    if (!bundle) return;
    updateBundleMutation.mutate(
      {
        bundleId: bundle.id,
        title: values.title,
        description: values.description ?? '',
        price: values.price,
        thumbnailUrl: values.thumbnailUrl ?? null,
        thumbnailFileId: values.thumbnailFileId ?? null,
        introVideoUrl: values.introVideoUrl ?? null,
        introVideoFileId: values.introVideoFileId ?? null,
        // The server refuses item changes on a published bundle; leaving the
        // lists out means an unchanged save can never trip that check.
        ...(bundle.isPublished
          ? {}
          : { courseIds: values.courseIds, testIds: values.testIds, digitalProductIds: values.digitalProductIds }),
      },
      { onSuccess: onSaved }
    );
  };

  const handleSubmit = (values: BundleFormValues) =>
    save(values, () => {
      if (isAdminEdit) {
        navigate(exitTo);
        return;
      }
      setSavedAt(Date.now());
      refetch();
    });

  const handlePublish = (values: BundleFormValues, hasChanges: boolean) => {
    if (!bundle) return;
    const publish = () =>
      publishBundleMutation.mutate({ bundleId: bundle.id, publish: true }, { onSuccess: () => refetch() });
    if (!hasChanges) {
      publish();
      return;
    }
    save(values, () => {
      setSavedAt(Date.now());
      publish();
    });
  };

  const top = guided ? (
    <TeacherFlowTop
      back={exitTo}
      label="Bundle steps"
      steps={bundleFlowSteps({ itemsDone: false, detailsDone: false, published: false })}
    />
  ) : null;

  if (isLoading) {
    return (
      <div className={styles.stack}>
        {top}
        <div className={styles.skeletonContainer}>
          <Skeleton style={{ height: '3rem' }} />
          <Skeleton style={{ height: '6rem' }} />
          <Skeleton style={{ height: '10rem' }} />
          <Skeleton style={{ height: '5rem' }} />
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className={styles.stack}>
        {top}
        <div className={styles.errorState} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            <AlertCircle size={26} />
          </span>
          <h2 className={styles.errorTitle}>Could not open this bundle</h2>
          <p className={styles.errorText}>
            {isError
              ? 'It may have been deleted, belong to another account, or the connection dropped.'
              : 'It may have been deleted, or it belongs to another account.'}
          </p>
          <div className={styles.errorActions}>
            <Button onClick={() => refetch()} disabled={isFetching}>
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link to={exitTo}>Go to {exitLabel}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BundleForm
      key={bundle.id}
      initialValues={{
        title: bundle.title,
        description: bundle.description || '',
        courseIds: bundle.courseIds,
        testIds: bundle.testIds,
        digitalProductIds: bundle.digitalProductIds,
        price: bundle.price,
        thumbnailUrl: bundle.thumbnailUrl || null,
        thumbnailFileId: bundle.thumbnailFileId || null,
        introVideoUrl: bundle.introVideoUrl || null,
        introVideoFileId: bundle.introVideoFileId || null,
      }}
      isPublished={!!bundle.isPublished}
      selectedItems={bundle.items}
      onSubmit={handleSubmit}
      cancelTo={exitTo}
      isSubmitting={updateBundleMutation.isPending}
      submitText={guided && !bundle.isPublished ? 'Save draft' : 'Save changes'}
      guided={guided}
      intro={intro}
      onPublish={guided ? handlePublish : undefined}
      isPublishing={publishBundleMutation.isPending}
      savedAt={savedAt}
    />
  );
};