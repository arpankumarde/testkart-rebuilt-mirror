import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { ContentVisibilityPicker } from '../components/ContentVisibilityPicker';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { AIContentPrompt } from '../components/AIContentPrompt';
import { useAuth } from '../helpers/useAuth';
import { DEFAULT_CONTENT_VISIBILITY } from '../helpers/contentVisibility';
import type { ContentVisibility } from '../helpers/schema';
import styles from './teacher.products.create.module.css';

const TeacherCreateProductPage: React.FC = () => {
  const { authState } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [aiGeneratedValues, setAiGeneratedValues] = useState<any>(null);
  const [visibility, setVisibility] = useState<ContentVisibility>(DEFAULT_CONTENT_VISIBILITY);

  const user = authState.type === 'authenticated' ? authState.user : null;

  return (
    <>
      <Helmet>
        <title>Create Product - Teacher Dashboard | Testkart</title>
        <meta name="description" content="Create a new digital product to sell on your platform." />
      </Helmet>
      {!showForm ? (
        <AIContentPrompt
          contentType="product"
          teacherName={user?.displayName}
          onGenerated={(data) => {
            setAiGeneratedValues(data);
            setShowForm(true);
          }}
          onSkip={() => setShowForm(true)}
        />
      ) : (
        <div className={styles.page}>
          <TeacherFormHeader
            backTo="/teacher/products"
            backLabel="Notes & PDFs"
            title="Create a note or PDF"
            subtitle="Add the details and save a draft. You upload the PDF files on the next step."
          />
          <ContentVisibilityPicker value={visibility} onChange={setVisibility} className={styles.visibility} />
          <ProductStepForm aiInitialValues={aiGeneratedValues} visibility={visibility} />
        </div>
      )}
    </>
  );
};

export default TeacherCreateProductPage;
