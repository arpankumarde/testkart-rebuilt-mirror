import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { ContentVisibilityPicker } from '../components/ContentVisibilityPicker';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { TeacherAIFillPanel, type TeacherAIFillValues } from '../components/TeacherAIFillPanel';
import { TeacherFlowSteps } from '../components/TeacherFlowSteps';
import { usePublishesWithoutReview } from '../helpers/usePublishesWithoutReview';
import { DEFAULT_CONTENT_VISIBILITY } from '../helpers/contentVisibility';
import type { ContentVisibility } from '../helpers/schema';
import styles from './teacher.products.create.module.css';

const TeacherCreateProductPage: React.FC = () => {
  // The form takes AI values when it mounts, so each fill remounts it.
  const [aiFill, setAiFill] = useState<{ key: number; values: TeacherAIFillValues } | null>(null);
  const [visibility, setVisibility] = useState<ContentVisibility>(DEFAULT_CONTENT_VISIBILITY);
  const publishesDirectly = usePublishesWithoutReview();

  return (
    <>
      <Helmet>
        <title>Create a note or PDF | Testkart</title>
        <meta name="description" content="Create study notes or a PDF to sell on Testkart." />
      </Helmet>
      <div className={styles.page}>
          <TeacherFormHeader kind="digital_product"
            backTo="/teacher/products"
            backLabel="Notes and PDFs"
            title="Create a note or PDF"
            subtitle="Start with the details. You upload the PDFs next, and nothing goes live until you publish."
          />
          <TeacherFlowSteps
            label="Study note steps"
            steps={[
              { key: 'details', label: 'Details', hint: 'Title, exam and price', state: 'current' },
              { key: 'files', label: 'PDFs', hint: 'Upload your files', state: 'todo' },
              { key: 'publish', label: 'Publish', hint: publishesDirectly ? 'Go live' : 'Send for review', state: 'todo' },
            ]}
          />
          <TeacherAIFillPanel
            contentType="product"
            fills="title, description, exam, category and price"
            placeholder="e.g., Chapter-wise Hindi notes for UPSC Prelims Polity, 120 pages"
            onGenerated={(values) => setAiFill((prev) => ({ key: (prev?.key ?? 0) + 1, values }))}
          />
          <ContentVisibilityPicker value={visibility} onChange={setVisibility} />
          <ProductStepForm key={aiFill?.key ?? 0} aiInitialValues={aiFill?.values ?? null} visibility={visibility} />
        </div>
    </>
  );
};

export default TeacherCreateProductPage;
