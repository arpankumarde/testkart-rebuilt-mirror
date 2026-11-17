import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { ContentVisibilityPicker } from '../components/ContentVisibilityPicker';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { TeacherAIFillPanel, type TeacherAIFillValues } from '../components/TeacherAIFillPanel';
import { DEFAULT_CONTENT_VISIBILITY } from '../helpers/contentVisibility';
import type { ContentVisibility } from '../helpers/schema';
import styles from './teacher.products.create.module.css';

const TeacherCreateProductPage: React.FC = () => {
  // Each fill is a new object, which the form applies in place so uploaded PDFs are kept.
  const [aiValues, setAiValues] = useState<TeacherAIFillValues | null>(null);
  const [visibility, setVisibility] = useState<ContentVisibility>(DEFAULT_CONTENT_VISIBILITY);

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
            subtitle="Start by uploading your PDFs, then add the details. Nothing goes live until you publish."
          />
          <ProductStepForm
            aiInitialValues={aiValues}
            visibility={visibility}
            detailsIntro={
              <>
                <TeacherAIFillPanel
                  contentType="product"
                  fills="title, description, exam, category and price"
                  placeholder="e.g., Chapter-wise Hindi notes for UPSC Prelims Polity, 120 pages"
                  onGenerated={setAiValues}
                />
                <ContentVisibilityPicker value={visibility} onChange={setVisibility} />
              </>
            }
          />
        </div>
    </>
  );
};

export default TeacherCreateProductPage;
