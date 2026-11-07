import React from 'react';
import { useParams } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { BundleEditor } from '../components/BundleEditor';
import { TeacherRejectionBanner } from '../components/TeacherRejectionBanner';
import { TeacherFoldedPanel } from '../components/TeacherFoldedPanel';
import { ContentVisibilityPanel } from '../components/ContentVisibilityPanel';
import { ContentExpiryPanel } from '../components/ContentExpiryPanel';
import styles from './teacher.bundles.$bundleId.edit.module.css';

export default function EditBundlePage() {
  const { bundleId } = useParams();
  const parsedId = parseInt(bundleId || '', 10);
  const id = isNaN(parsedId) ? undefined : parsedId;

  return (
    <>
      <SEOHead
        title="Edit Bundle | Testkart"
        description="Edit your course bundle details and pricing."
      />
      <div className={`${styles.page} tk-flow`}>
        <BundleEditor
          bundleId={id}
          exitTo="/teacher/bundles"
          exitLabel="Bundles"
          guided
          intro={<TeacherRejectionBanner contentType="course_bundle" contentId={id} />}
        />

        {/* Visibility and expiry are rarely changed, so they wait folded under the form. */}
        {id !== undefined && (
          <TeacherFoldedPanel title="More settings" hint="Who can find the bundle, and when it stops selling.">
            <ContentVisibilityPanel contentType="course_bundle" contentId={id} variant="inline" />
            <ContentExpiryPanel contentType="course_bundle" contentId={id} variant="inline" />
          </TeacherFoldedPanel>
        )}
      </div>
    </>
  );
}