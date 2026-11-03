import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { TeacherRejectionBanner } from '../components/TeacherRejectionBanner';
import styles from './teacher.products.$productId.edit.module.css';

const TeacherEditProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const parsedId = productId ? parseInt(productId, 10) : undefined;

  return (
    <>
      <Helmet>
        <title>Edit note or PDF | Testkart</title>
        <meta name="description" content="Edit your study notes or PDF on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader kind="digital_product"
          backTo="/teacher/products"
          backLabel="Notes and PDFs"
          title="Edit note or PDF"
          subtitle="Update the details or PDFs, then save or publish."
        />

        <TeacherRejectionBanner contentType="digital_product" contentId={parsedId} />

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
