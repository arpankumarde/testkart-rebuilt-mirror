import React from 'react';
import { useParams } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleEditor } from '../components/BundleEditor';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { TeacherRejectionBanner } from '../components/TeacherRejectionBanner';
import { useTeacherBundleDetailsQuery } from '../helpers/useTeacherBundleDetailsQuery';
import styles from './teacher.bundles.$bundleId.edit.module.css';

export default function EditBundlePage() {
  const { bundleId } = useParams();
  const parsedId = parseInt(bundleId || '', 10);
  const id = isNaN(parsedId) ? undefined : parsedId;
  const { data: bundle } = useTeacherBundleDetailsQuery(id);

  return (
    <>
      <SEOHead 
        title="Edit Bundle | Testkart" 
        description="Edit your course bundle details and pricing." 
      />
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/bundles"
          backLabel="Bundles"
          title="Edit bundle"
          subtitle={bundle?.title}
        />

        <TeacherRejectionBanner contentType="course_bundle" contentId={id} />

        <div className={styles.content}>
          <BundleEditor bundleId={id} exitTo="/teacher/bundles" exitLabel="Bundles" />
        </div>
      </div>
    </>
  );
}