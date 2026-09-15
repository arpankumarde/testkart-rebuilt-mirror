import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ProductStepForm } from '../components/ProductStepForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { AIContentPrompt } from '../components/AIContentPrompt';
import { useAuth } from '../helpers/useAuth';
import styles from './teacher.products.create.module.css';

const TeacherCreateProductPage: React.FC = () => {
  const { authState } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [aiGeneratedValues, setAiGeneratedValues] = useState<any>(null);

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
          <ProductStepForm aiInitialValues={aiGeneratedValues} />
        </div>
      )}
    </>
  );
};

export default TeacherCreateProductPage;
