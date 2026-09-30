import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useAiConnections } from '../helpers/useAiConnections';
import { useTeacherSignIns } from '../helpers/useTeacherSignIns';
import { EditProfilePrivateSection } from '../components/EditProfilePrivateSection';
import { ConnectedAppsSection, OtherDevicesSection } from '../components/TeacherAccountAccess';
import { BillingDetailsSection } from '../components/BillingDetailsSection';
import { TeamManagementSection } from '../components/TeamManagementSection';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import styles from './teacher.settings.module.css';

type SectionLink = { id: string; label: string; count?: number };

/*
 * Highlights the last section whose top has passed a line a quarter of the way down the viewport.
 * At the very bottom of the page the last section wins, since a short one can never reach the line.
 */
const useActiveSection = (ids: string[]) => {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(',');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.25;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const scroller = document.scrollingElement;
      if (scroller && scroller.scrollTop > 0 && scroller.scrollTop + window.innerHeight >= scroller.scrollHeight - 2) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [active, setActive] as const;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TeacherSettingsPage: React.FC = () => {
  const { authState } = useAuth();
  const location = useLocation();
  const isAuthenticated = authState.type === 'authenticated';
  const isOwner = isAuthenticated && authState.user.teacherRole !== 'manager';

  const { data: apps } = useAiConnections('teacher', isAuthenticated);
  const { data: signIns } = useTeacherSignIns();

  const sections: SectionLink[] = [
    { id: 'sign-in', label: 'Sign-in details' },
    { id: 'ai-apps', label: 'Connected AI apps', count: apps?.connections.length },
    { id: 'devices', label: 'Other devices', count: signIns?.count },
    { id: 'billing', label: 'Billing details' },
    ...(isOwner ? [{ id: 'team', label: 'Team' }] : []),
    { id: 'close-account', label: 'Close account' },
  ];
  const [active, setActive] = useActiveSection(sections.map((s) => s.id));

  // Deep links such as /teacher/settings#ai-apps land on their section once the page has rendered.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = location.hash.slice(1);
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      setActive(id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAuthenticated, location.hash, setActive]);

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(window.history.state, '', `#${id}`);
    setActive(id);
  };

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
        <meta
          name="description"
          content="Manage how you sign in, the AI apps and devices that can reach your account, billing and your team."
        />
      </Helmet>

      <div className={styles.page}>
        <TeacherPageHeader title="Settings" />

        <div className={styles.layout}>
          <nav className={styles.index} aria-label="Settings sections">
            <ul className={styles.indexList} role="list">
              {sections.map((section) => (
                <li
                  key={section.id}
                  className={section.id === 'billing' || section.id === 'close-account' ? styles.indexBreak : undefined}
                >
                  <a
                    href={`#${section.id}`}
                    className={styles.indexLink}
                    aria-current={active === section.id ? 'location' : undefined}
                    onClick={(event) => jumpTo(event, section.id)}
                  >
                    <span>{section.label}</span>
                    {section.count !== undefined && section.count > 0 && (
                      <span className={styles.indexCount}>{section.count}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.stack}>
            <div id="sign-in" className={`${styles.panel} ${styles.anchor}`}>
              <EditProfilePrivateSection user={user} />
            </div>

            <ConnectedAppsSection id="ai-apps" />

            <OtherDevicesSection id="devices" />

            <div id="billing" className={styles.anchor}>
              <BillingDetailsSection />
            </div>

            {isOwner && (
              <div id="team" className={styles.anchor}>
                <TeamManagementSection />
              </div>
            )}

            <section id="close-account" className={`${styles.danger} ${styles.anchor}`} aria-labelledby="close-account-title">
              <h2 id="close-account-title" className={styles.dangerTitle}>Close your account</h2>
              <p className={styles.dangerText}>
                This permanently deletes your account and everything in it - test series, courses,
                students and earnings history. It cannot be undone.
              </p>
              <Button asChild variant="outline" className={styles.dangerButton}>
                <Link to="/close-account">
                  <Trash2 size={16} /> Close account
                </Link>
              </Button>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherSettingsPage;