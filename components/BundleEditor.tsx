import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { BundleForm, BundleFormValues } from './BundleForm';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useTeacherBundleDetailsQuery } from '../helpers/useTeacherBundleDetailsQuery';
import styles from './BundleEditor.module.css';

interface BundleEditorProps {
  bundleId: number | undefined;
  /** Where Cancel and a finished save go. */
  exitTo: string;
  exitLabel: string;
}

/* Loads a saved bundle into BundleForm and saves it. Shared by the teacher and admin edit pages. */
export const BundleEditor = ({ bundleId, exitTo, exitLabel }: BundleEditorProps) => {
  const navigate = useNavigate();
  const { data: bundle, isLoading, isError, refetch, isFetching } = useTeacherBundleDetailsQuery(bundleId);
  const { updateBundleMutation } = useBundleMutations();

  const handleSubmit = (values: BundleFormValues) => {
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
      { onSuccess: () => navigate(exitTo) }
    );
  };

  if (isLoading) {
    return (
      <div className={styles.skeletonContainer}>
        <Skeleton style={{ height: '3rem' }} />
        <Skeleton style={{ height: '6rem' }} />
        <Skeleton style={{ height: '10rem' }} />
        <Skeleton style={{ height: '5rem' }} />
      </div>
    );
  }

  if (!bundle) {
    return (
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
      submitText="Save changes"
    />
  );
};