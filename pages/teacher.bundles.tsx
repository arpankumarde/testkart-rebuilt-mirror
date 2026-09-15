import React from 'react';
import { SEOHead } from '../components/SEOHead';
import { BundleManager } from '../components/BundleManager';

const TeacherBundlesPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Bundles - Testkart for Teachers"
        description="Create, manage, and sell collections of your courses. Set custom prices and publish your bundles to reach more students on Testkart."
      />
      <BundleManager />
    </>
  );
};

export default TeacherBundlesPage;
