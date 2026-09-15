import React from 'react';
import { useStudentCertificates } from '../helpers/useCertificateQueries';
import { useQuery } from '@tanstack/react-query';
import { getStudentEnrolledCourses } from '../endpoints/student/enrolled-courses_GET.schema';
import { getStudentEnrolledTests } from '../endpoints/student/enrolled-tests_GET.schema';
import { CertificateCard } from './CertificateCard';
import { EligibleCertificateCard } from './CertificateCard';
import { Skeleton } from './Skeleton';
import { Award, FileX2 } from 'lucide-react';
import styles from './StudentCertificates.module.css';

const StudentCertificatesSkeleton = () => (
  <div className={styles.grid}>
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className={styles.skeletonCard}>
        <div className={styles.skeletonHeader}>
          <Skeleton style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)' }} />
          <div className={styles.skeletonHeaderText}>
            <Skeleton style={{ height: '1.25rem', width: '80%' }} />
            <Skeleton style={{ height: '1rem', width: '50%' }} />
          </div>
        </div>
        <div className={styles.skeletonFooter}>
          <Skeleton style={{ height: '2.5rem', width: '120px' }} />
        </div>
      </div>
    ))}
  </div>
);

export const StudentCertificates = () => {
  const { data: certificatesData, isFetching: isCertificatesFetching, error: certificatesError } = useStudentCertificates();
  
  const { data: enrolledCoursesData, isFetching: isCoursesFetching } = useQuery({
    queryKey: ['student', 'enrolled-courses'],
    queryFn: getStudentEnrolledCourses,
  });

  const { data: enrolledTestsData, isFetching: isTestsFetching } = useQuery({
    queryKey: ['student', 'enrolled-tests'],
    queryFn: () => getStudentEnrolledTests({}),
  });

  const isFetching = isCertificatesFetching || isCoursesFetching || isTestsFetching;

  const completedCourses = (enrolledCoursesData?.enrolledCourses || [])
    .filter(course => course.completionPercentage >= 100);

  const completedTests = (enrolledTestsData?.enrolledTests || [])
    .flatMap(testPackage => testPackage.testItems)
    .filter(item => item.isCompleted);

  const existingCertificateItemNames = new Set(certificatesData?.certificates.map(c => c.itemName));

  const eligibleCourses = completedCourses.filter(course => !existingCertificateItemNames.has(course.title));
  const eligibleTests = completedTests.filter(test => !existingCertificateItemNames.has(test.title));

  const eligibleCount = eligibleCourses.length + eligibleTests.length;
  const hasEligibleItems = eligibleCount > 0;
  const hasCertificates = certificatesData && certificatesData.certificates.length > 0;

  return (
    <div className={styles.container}>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Earned
            {hasCertificates && (
              <span className={styles.sectionCount}>{certificatesData.certificates.length}</span>
            )}
          </h2>
        </div>

        {isFetching && <StudentCertificatesSkeleton />}

        {!isFetching && certificatesError && (
          <div className={styles.stateBlock} role="alert">
            <span className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true">
              <FileX2 size={20} />
            </span>
            <h3 className={styles.stateTitle}>Could not load your certificates</h3>
            <p className={styles.stateHint}>
              The request did not come back. Reload the page to try again.
            </p>
          </div>
        )}

        {!isFetching && !certificatesError && (
          <>
            {hasCertificates ? (
              <div className={styles.grid}>
                {certificatesData.certificates.map(cert => (
                  <CertificateCard key={cert.id} certificate={cert} />
                ))}
              </div>
            ) : (
              <div className={styles.stateBlock}>
                <span className={styles.stateIcon} aria-hidden="true">
                  <Award size={20} />
                </span>
                <h3 className={styles.stateTitle}>No certificates yet</h3>
                <p className={styles.stateHint}>
                  Finish a course or a test and its certificate appears here to download and share.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {hasEligibleItems && (
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Ready to claim
              <span className={styles.sectionCount}>{eligibleCount}</span>
            </h2>
          </div>
          <div className={styles.grid}>
            {eligibleCourses.map(course => (
              <EligibleCertificateCard
                key={`course-${course.id}`}
                item={{
                  id: course.id,
                  name: course.title,
                  type: 'course_completion',
                  completedAt: new Date(), // Assuming completion is recent
                }}
              />
            ))}
            {eligibleTests.map(test => (
              <EligibleCertificateCard
                key={`test-${test.id}`}
                item={{
                  id: test.id,
                  name: test.title,
                  type: 'test_completion',
                  completedAt: test.lastAttemptedAt || new Date(),
                  score: test.bestScore,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
