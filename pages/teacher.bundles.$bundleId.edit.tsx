import React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { BundleForm, BundleFormValues } from '../components/BundleForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useTeacherBundleDetailsQuery } from '../helpers/useTeacherBundleDetailsQuery';
import styles from './teacher.bundles.$bundleId.edit.module.css';

export default function EditBundlePage() {
  const navigate = useNavigate();
  const { bundleId } = useParams();
  const parsedId = parseInt(bundleId || '', 10);
  
  const { data: bundle, isLoading, isError, refetch, isFetching } = useTeacherBundleDetailsQuery(
    isNaN(parsedId) ? undefined : parsedId
  );
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
      { onSuccess: () => navigate('/teacher/bundles') }
    );
  };

  return (
    <>
      <SEOHead 
        title="Edit Bundle | Testkart" 
        description="Edit your course bundle details and pricing." 
      />
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/bundles"
          backLabel="Bundles"
          title="Edit bundle"
          subtitle={bundle?.title}
        />

        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.skeletonContainer}>
              <Skeleton style={{ height: '3rem' }} />
              <Skeleton style={{ height: '6rem' }} />
              <Skeleton style={{ height: '10rem' }} />
              <Skeleton style={{ height: '5rem' }} />
            </div>
          ) : !bundle ? (
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
                  <Link to="/teacher/bundles">Go to Bundles</Link>
                </Button>
              </div>
            </div>
          ) : (
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
              cancelTo="/teacher/bundles"
              isSubmitting={updateBundleMutation.isPending}
              submitText="Save changes"
            />
          )}
        </div>
      </div>
    </>
  );
}
