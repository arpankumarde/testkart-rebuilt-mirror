import React from 'react';
import { PromoCodeManager } from '../components/PromoCodeManager';
import { SEOHead } from '../components/SEOHead';

/* Thin wrapper with no chrome of its own - PromoCodeManager owns the page
   shell, the same split Products and Bundles use. */
const TeacherPromoCodesPage = () => {
  return (
    <>
      <SEOHead
        title="Manage Promo Codes"
        description="Create, manage, and track your promotional codes to boost sales for your mock tests and courses on Testkart." />

      <PromoCodeManager />
    </>);

};

export default TeacherPromoCodesPage;
