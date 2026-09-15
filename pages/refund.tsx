import React from 'react';
import { Helmet } from 'react-helmet';
import { useStaticPageQuery } from '../helpers/useStaticPages';
import { wrapContentTables } from '../helpers/contentTables';
import { Skeleton } from '../components/Skeleton';
// Reusing styles from terms page for consistency
import styles from './terms.module.css';

const RefundPageSkeleton: React.FC = () => (
  <div className={styles.container}>
    <Skeleton style={{ height: '40px', width: '300px', marginBottom: 'var(--spacing-8)' }} />
    <Skeleton style={{ height: '20px', width: '100%', marginBottom: 'var(--spacing-2)' }} />
    <Skeleton style={{ height: '20px', width: '90%', marginBottom: 'var(--spacing-2)' }} />
    <Skeleton style={{ height: '20px', width: '95%', marginBottom: 'var(--spacing-6)' }} />
    <Skeleton style={{ height: '20px', width: '100%', marginBottom: 'var(--spacing-2)' }} />
    <Skeleton style={{ height: '20px', width: '80%', marginBottom: 'var(--spacing-2)' }} />
  </div>
);

const RefundPage: React.FC = () => {
  const { data: page, isFetching, error } = useStaticPageQuery('refund');

  return (
    <>
      <Helmet>
        <title>Refund Policy - Testkart</title>
        <meta name="description" content="Read the Refund Policy for Testkart. Understand the terms and conditions for refunds on our platform." />
        <link rel="canonical" href="https://testkart.in/refund" />
      </Helmet>
      <div className={styles.pageWrapper}>
        {isFetching ? (
          <RefundPageSkeleton />
        ) : error ? (
          <div className={styles.container}>
            <h1 className={styles.title}>Error</h1>
            <p>Could not load the refund policy. Please try again later.</p>
            {error instanceof Error && <p className={styles.errorMessage}>{error.message}</p>}
          </div>
        ) : page ? (
          <div className={styles.container}>
            <h1 className={styles.title}>{page.title}</h1>
            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: wrapContentTables(page.content) }}
            />
            {page.updatedAt && (
              <p className={styles.lastUpdated}>
                Last Updated: {new Date(page.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        ) : (
           <div className={styles.container}>
            <h1 className={styles.title}>Refund Policy</h1>
            <p>This page is not available at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default RefundPage;