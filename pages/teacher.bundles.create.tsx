import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleForm, BundleFormValues } from '../components/BundleForm';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { TeacherAIFillPanel, type TeacherAIFillValues } from '../components/TeacherAIFillPanel';
import styles from './teacher.bundles.create.module.css';

export default function CreateBundlePage() {
  const navigate = useNavigate();
  const { createBundleMutation } = useBundleMutations();
  // The form takes AI values when it mounts, so each fill remounts it.
  const [aiFill, setAiFill] = useState<{ key: number; values: TeacherAIFillValues } | null>(null);
  const aiInitialValues = aiFill?.values ?? null;

  // New bundles start public. After creating, the teacher lands on the edit
  // page, where visibility and publishing live.
  const handleSubmit = (values: BundleFormValues) => {
    createBundleMutation.mutate(values, {
      onSuccess: (data) => navigate(`/teacher/bundles/${data.id}/edit`, { replace: true }),
    });
  };

  return (
    <>
      <SEOHead 
        title="Create New Bundle | Testkart" 
        description="Create a new course bundle for your students." 
      />
      <div className={styles.page}>
          <TeacherFormHeader kind="bundle"
            backTo="/teacher/bundles"
            backLabel="Bundles"
            title="Create a bundle"
            subtitle="Sell test series, courses and notes together at one price."
          />
          <TeacherAIFillPanel
            contentType="bundle"
            fills="title, description and price"
            placeholder="e.g., Everything for SSC CGL: my mock tests, notes and the reasoning course"
            onGenerated={(values) => setAiFill((prev) => ({ key: (prev?.key ?? 0) + 1, values }))}
          />

          <div className={styles.content}>
            <BundleForm
              key={aiFill?.key ?? 0}
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
    </>
  );
}
