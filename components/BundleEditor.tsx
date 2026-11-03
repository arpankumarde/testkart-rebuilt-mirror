import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Send } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { BundleForm, BundleFormValues } from './BundleForm';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useTeacherBundleDetailsQuery } from '../helpers/useTeacherBundleDetailsQuery';
import styles from './BundleEditor.module.css';

interface BundleEditorProps {
  bundleId: number | undefined;
  /** Where Cancel goes; the admin edit page also returns there after a save. */
  exitTo: string;
  exitLabel: string;
}

/*
 * Loads a saved bundle into BundleForm and saves it. Shared by the teacher and
 * admin edit pages. Teachers stay on the page after saving and can publish a
 * draft from here, instead of finding the Publish action on the list card.
 */
export const BundleEditor = ({ bundleId, exitTo, exitLabel }: BundleEditorProps) => {
  const navigate = useNavigate();
  const { data: bundle, isLoading, isError, refetch, isFetching } = useTeacherBundleDetailsQuery(bundleId);
  const { updateBundleMutation, publishBundleMutation } = useBundleMutations();
  const isAdminEdit = exitTo.startsWith('/admin');

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
      {
        onSuccess: () => {
          if (isAdminEdit) navigate(exitTo);
          else refetch();
        },
      }
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
    <>
    {!isAdminEdit && !bundle.isPublished && (
      <div className={styles.publishBar}>
        <div className={styles.publishText}>
          <strong>This bundle is a draft.</strong>
          <span>
            Publish it once it holds 2 or more of your published items. Save any changes below first.
          </span>
        </div>
        <Button
          onClick={() =>
            publishBundleMutation.mutate({ bundleId: bundle.id, publish: true }, { onSuccess: () => refetch() })
          }
          disabled={publishBundleMutation.isPending || updateBundleMutation.isPending}
        >
          <Send size={16} aria-hidden="true" />
          {publishBundleMutation.isPending ? 'Publishing' : 'Publish bundle'}
        </Button>
      </div>
    )}
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
    </>
  );
};