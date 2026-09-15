import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleForm, BundleFormValues } from '../components/BundleForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { AIContentPrompt } from '../components/AIContentPrompt';
import { useAuth } from '../helpers/useAuth';
import styles from './teacher.bundles.create.module.css';

export default function CreateBundlePage() {
  const navigate = useNavigate();
  const { createBundleMutation } = useBundleMutations();
  const { authState } = useAuth();
  const teacherName =
    authState.type === "authenticated" ? authState.user.displayName : undefined;

  const [showAIPrompt, setShowAIPrompt] = useState(true);
  const [aiInitialValues, setAiInitialValues] = useState<any>(null);

  const handleSubmit = (values: BundleFormValues) => {
    createBundleMutation.mutate(values, {
      onSuccess: () => navigate('/teacher/bundles'),
    });
  };

  const handleGenerated = (data: any) => {
    setAiInitialValues(data);
    setShowAIPrompt(false);
  };

  return (
    <>
      <SEOHead 
        title="Create New Bundle | Testkart" 
        description="Create a new course bundle for your students." 
      />
      {showAIPrompt ? (
        <AIContentPrompt
          contentType="bundle"
          teacherName={teacherName}
          onGenerated={handleGenerated}
          onSkip={() => setShowAIPrompt(false)}
        />
      ) : (
        <div className={styles.page}>
          <TeacherFormHeader
            backTo="/teacher/bundles"
            backLabel="Bundles"
            title="Create a bundle"
            subtitle="Sell test series, courses and notes together at one price."
          />

          <div className={styles.content}>
            <BundleForm
              initialValues={aiInitialValues ? {
                title: aiInitialValues.title,
                description: aiInitialValues.description,
                price: aiInitialValues.suggestedPrice || 0,
              } : undefined}
              onSubmit={handleSubmit}
              cancelTo="/teacher/bundles"
              isSubmitting={createBundleMutation.isPending}
              submitText="Create bundle"
            />
          </div>
        </div>
      )}
    </>
  );
}
