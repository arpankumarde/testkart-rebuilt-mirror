import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleForm, BundleFormValues } from '../components/BundleForm';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { TeacherAIFillPanel, type TeacherAIFillValues } from '../components/TeacherAIFillPanel';
import styles from './teacher.bundles.create.module.css';

export default function CreateBundlePage() {
  const navigate = useNavigate();
  const { createBundleMutation, publishBundleMutation } = useBundleMutations();
  // The form takes AI values when it mounts, so each fill remounts it.
  const [aiFill, setAiFill] = useState<{ key: number; values: TeacherAIFillValues } | null>(null);
  const aiInitialValues = aiFill?.values ?? null;

  // New bundles start public. Save draft lands on the edit page; Publish
  // creates and publishes in one go, then returns to the list. If publishing
  // fails, the draft is kept and opens in the editor.
  const create = (values: BundleFormValues, publish: boolean) => {
    createBundleMutation.mutate(values, {
      onSuccess: (data) => {
        const editPath = `/teacher/bundles/${data.id}/edit`;
        if (!publish) {
          navigate(editPath, { replace: true });
          return;
        }
        publishBundleMutation.mutate(
          { bundleId: data.id, publish: true },
          {
            onSuccess: () => navigate('/teacher/bundles', { replace: true }),
            onError: () => navigate(editPath, { replace: true }),
          }
        );
      },
    });
  };

  return (
    <>
      <SEOHead
        title="Create New Bundle | Testkart"
        description="Create a new course bundle for your students."
      />
      <div className={`${styles.page} tk-flow`}>
        <BundleForm
          key={aiFill?.key ?? 0}
          guided
          intro={
            <TeacherAIFillPanel
              contentType="bundle"
              fills="title, description and price"
              placeholder="e.g., Everything for SSC CGL: my mock tests, notes and the reasoning course"
              onGenerated={(values) => setAiFill((prev) => ({ key: (prev?.key ?? 0) + 1, values }))}
            />
          }
          initialValues={aiInitialValues ? {
            title: aiInitialValues.title,
            description: aiInitialValues.description,
            price: aiInitialValues.suggestedPrice || 0,
          } : undefined}
          onSubmit={(values) => create(values, false)}
          onPublish={(values) => create(values, true)}
          cancelTo="/teacher/bundles"
          isSubmitting={createBundleMutation.isPending && !publishBundleMutation.isPending}
          isPublishing={publishBundleMutation.isPending}
          submitText="Save draft"
        />
      </div>
    </>
  );
}