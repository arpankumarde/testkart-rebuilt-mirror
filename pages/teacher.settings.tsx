import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { EditProfilePrivateSection } from '../components/EditProfilePrivateSection';
import { BillingDetailsSection } from '../components/BillingDetailsSection';
import { TeamManagementSection } from '../components/TeamManagementSection';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import styles from './teacher.settings.module.css';

const TeacherSettingsPage: React.FC = () => {
  const { authState } = useAuth();

  if (authState.type === 'loading') {
    return (
      <div className={styles.page}>
        <TeacherPageHeader title="Settings" />
        <div className={styles.stack}>
          <div className={styles.panel}>
            <Skeleton style={{ height: '1.5rem', width: '150px', marginBottom: 'var(--spacing-6)' }} />
            <Skeleton style={{ height: '2.5rem', width: '100%', marginBottom: 'var(--spacing-4)' }} />
            <Skeleton style={{ height: '2.5rem', width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (authState.type !== 'authenticated') {
    return null;
  }

  const { user } = authState;

  return (
    <>
      <Helmet>
        <title>Settings - Testkart</title>
        <meta name="description" content="Manage your account settings and private credentials." />
      </Helmet>

      <div className={styles.page}>
        <TeacherPageHeader title="Settings" />

        <div className={styles.stack}>
          <div className={styles.panel}>
            <EditProfilePrivateSection user={user} />
          </div>

          <BillingDetailsSection />

          {user.teacherRole !== 'manager' && <TeamManagementSection />}

          <div className={styles.danger}>
            <h2 className={styles.dangerTitle}>Close your account</h2>
            <p className={styles.dangerText}>
              This permanently deletes your account and everything in it - test series, courses,
              students and earnings history. It cannot be undone.
            </p>
            <Button asChild variant="outline" className={styles.dangerButton}>
              <Link to="/close-account">
                <Trash2 size={16} /> Close account
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherSettingsPage;
