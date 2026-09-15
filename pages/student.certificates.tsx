import React from 'react';
import { StudentCertificates as StudentCertificatesComponent } from '../components/StudentCertificates';
import { SEOHead } from '../components/SEOHead';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import styles from './student.certificates.module.css';

const StudentCertificatesPage = () => {
  return (
    <>
      <SEOHead
        title="Certificates"
        description="View, download, and manage all your earned certificates for completed courses and mock tests on Testkart." />

      <div className={styles.page}>
        <ConsolePageHeader title="Certificates" />
        <StudentCertificatesComponent />
      </div>
    </>
  );
};

export default StudentCertificatesPage;
