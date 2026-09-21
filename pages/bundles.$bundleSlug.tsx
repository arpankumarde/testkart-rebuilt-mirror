import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SEOHead } from '../components/SEOHead';
import { BundleDetailsView } from '../components/BundleDetailsView';
import { getBundlesList } from '../endpoints/bundles/list_GET.schema';
import { BundlesGrid } from '../components/BundlesGrid';
import { useBundleDetailsQuery } from '../helpers/useBundlesQuery';
import { TeacherCtaBanner } from '../components/TeacherCtaBanner';
import { ShareButton } from '../components/ShareButton';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { useTrackStorefrontView } from '../helpers/trackStorefrontEvent';
import styles from './bundles.$bundleSlug.module.css';

const ShareBundle: React.FC<{ slug: string; title: string }> = ({ slug, title }) => (
  <div className={styles.shareContainer}>
    <h4 className={styles.shareTitle}>Share this bundle</h4>
    <ShareButton
      kind="bundle"
      handle={slug}
      title={title}
      campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
      size="lg"
    />
  </div>
);

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
  const { data: bundle } = useBundleDetailsQuery(bundleSlug || '');
  useTrackStorefrontView("bundle", bundle?.id);

  if (!bundleSlug) {
    return (
      <div className={styles.errorState}>
        <h2>Invalid URL</h2>
        <p>The bundle you are looking for could not be found.</p>
        <Link to="/bundles">Browse Bundles</Link>
      </div>
    );
  }

  const pageUrl = `${window.location.origin}/bundles/${bundleSlug}`;

  return (
    <>
      {bundle && (
        <SEOHead
          title={bundle.title}
          description={bundle.description || `Explore the ${bundle.title} course bundle on Testkart.`}
          image={bundle.thumbnailUrl || undefined}
          url={pageUrl}
          noIndex={!bundle.seo.indexable}
        />
      )}
      <div className={styles.pageContainer}>
        <BundleDetailsView slug={bundleSlug} />
        {bundle && (
          <>
            <ShareBundle slug={bundleSlug} title={bundle.title} />
            <RelatedBundles teacherId={bundle.teacher.id} currentBundleId={bundle.id} />
            
            {bundle.disclaimer && (
              <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
                {bundle.disclaimer}
              </div>
            )}

            <TeacherCtaBanner className={styles.teacherCta} />
          </>
        )}
      </div>
    </>
  );
};

export default BundleDetailsPage;