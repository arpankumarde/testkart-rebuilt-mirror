import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleForm, BundleFormValues } from '../components/BundleForm';
import { ContentVisibilityPicker } from '../components/ContentVisibilityPicker';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { AIContentPrompt } from '../components/AIContentPrompt';
import { useAuth } from '../helpers/useAuth';
import { DEFAULT_CONTENT_VISIBILITY } from '../helpers/contentVisibility';
import type { ContentVisibility } from '../helpers/schema';
import styles from './teacher.bundles.create.module.css';

export default function CreateBundlePage() {
  const navigate = useNavigate();
  const { createBundleMutation } = useBundleMutations();
  const { authState } = useAuth();
  const teacherName =
    authState.type === "authenticated" ? authState.user.displayName : undefined;

  const [showAIPrompt, setShowAIPrompt] = useState(true);
  const [aiInitialValues, setAiInitialValues] = useState<any>(null);
  const [visibility, setVisibility] = useState<ContentVisibility>(DEFAULT_CONTENT_VISIBILITY);

  const handleSubmit = (values: BundleFormValues) => {
    createBundleMutation.mutate({ ...values, visibility }, {
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
            <ContentVisibilityPicker
              value={visibility}
              onChange={setVisibility}
              disabled={createBundleMutation.isPending}
              className={styles.visibility}
              footnote={
                visibility === 'public'
                  ? 'A public bundle can only go live with public, published items.'
                  : 'An unlisted bundle can hold public and unlisted items.'
              }
            />
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
