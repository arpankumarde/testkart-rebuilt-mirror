import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Spinner } from '../components/Spinner';
import styles from './teacher.test.$testId.edit.module.css';

export default function EditTestPage() {
  const { testId: testIdParam } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const testId = testIdParam ? parseInt(testIdParam, 10) : NaN;

  // The old edit URL now opens the multi-step editor; an unusable id goes to the dashboard.
  useEffect(() => {
    navigate(isNaN(testId) ? '/teacher/dashboard' : `/teacher/create-test/${testId}/test-items`, { replace: true });
  }, [testId, navigate]);

  return (
    <>
      <Helmet>
        <title>Redirecting... | Testkart</title>
        <meta name="description" content="Redirecting to test editor" />
      </Helmet>
      <div className={styles.status}>
        <Spinner size="lg" />
        <p className={styles.statusText}>Opening the test editor...</p>
      </div>
    </>
  );
}