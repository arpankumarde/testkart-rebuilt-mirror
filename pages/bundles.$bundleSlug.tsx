import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SEOHead } from '../components/SEOHead';
import { Placeholder } from '../helpers/placeholderImages';
import { BundleDetailsView } from '../components/BundleDetailsView';
import { getBundlesList } from '../endpoints/bundles/list_GET.schema';
import { BundlesGrid } from '../components/BundlesGrid';
import { useBundleDetailsQuery } from '../helpers/useBundlesQuery';
import { TeacherCtaBanner } from '../components/TeacherCtaBanner';
import { useTrackStorefrontView } from '../helpers/trackStorefrontEvent';
import { bundleDescriptionToPlainText } from '../helpers/bundleDescription';
import { NotFoundState } from '../components/NotFoundState';
import { isNotFoundError } from '../helpers/isNotFoundError';
import styles from './bundles.$bundleSlug.module.css';

const RelatedBundles: React.FC<{ teacherId: number; currentBundleId: number }> = ({ teacherId, currentBundleId }) => {
  const { data, isFetching } = useQuery({
    queryKey: ['public', 'bundles', 'related', { teacherId }],
    queryFn: () => getBundlesList({ teacherId, limit: 4 }),
  });

  const related = data?.bundles.filter(b => b.id !== currentBundleId).slice(0, 3);

  if (isFetching || !related || related.length === 0) {
    return null;
  }

  return (
    <section className={styles.relatedSection}>
      <h2 className={styles.relatedTitle}>More bundles from this teacher</h2>
      <BundlesGrid bundles={related} isLoading={false} />
    </section>
  );
};

const BundleDetailsPage: React.FC = () => {
  const { bundleSlug } = useParams<{ bundleSlug: string }>();
  const { data: bundle, isFetching, error } = useBundleDetailsQuery(bundleSlug || '');
  useTrackStorefrontView("bundle", bundle?.id);

  // Rendered here rather than inside BundleDetailsView so it sits outside this page's container.
  if (!bundleSlug || (!bundle && !isFetching && (!error || isNotFoundError(error)))) {
    return <NotFoundState kind="bundle" />;
  }

  const pageUrl = `${window.location.origin}/bundles/${bundleSlug}`;

  return (
    <>
      {bundle && (
        <SEOHead
          title={bundle.title}
          description={bundleDescriptionToPlainText(bundle.description) || `Explore the ${bundle.title} course bundle on Testkart.`}
          image={bundle.thumbnailUrl || Placeholder.TEST}
          url={pageUrl}
          noIndex={!bundle.seo.indexable}
        />
      )}
      <div className={styles.pageContainer}>
        <BundleDetailsView slug={bundleSlug} />
        {bundle && (
          <>
            <RelatedBundles teacherId={bundle.teacher.id} currentBundleId={bundle.id} />
            <TeacherCtaBanner className={styles.teacherCta} />
          </>
        )}
      </div>
    </>
  );
};

export default BundleDetailsPage;
