import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import styles from './teacher.products.$productId.edit.module.css';

const TeacherEditProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const parsedId = productId ? parseInt(productId, 10) : undefined;

  return (
    <>
      <Helmet>
        <title>Edit Product - Teacher Dashboard | Testkart</title>
        <meta name="description" content="Edit an existing digital product." />
      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/products"
          backLabel="Notes & PDFs"
          title="Edit note or PDF"
          subtitle="Update the details or files, then save the changes or publish."
        />

        {parsedId ? (
          // The form copies the product into its state once, and the router
          // reuses this page when only :productId changes, so the key forces
          // a fresh form per product.
          <ProductStepForm key={parsedId} productId={parsedId} />
        ) : (
          <div className={styles.error} role="alert">
            That product link is not valid. Open the item again from Notes &amp; PDFs.
          </div>
        )}
      </div>
    </>
  );
};

export default TeacherEditProductPage;
