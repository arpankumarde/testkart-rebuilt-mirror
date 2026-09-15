import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, User, GraduationCap, FileText, UserPlus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { AuthRoleSelectDialog } from './AuthRoleSelectDialog';
import styles from './MobileBottomNav.module.css';

const navItems = [
  { path: '/course', label: 'Courses', icon: GraduationCap },
  { path: '/mock-test', label: 'Tests', icon: FileText },
  { path: '/mock-test/live', label: 'Live', icon: Radio },
  { path: '/study-notes', label: 'Notes', icon: ShoppingBag },
  { path: '/profile', label: 'Profile', icon: User },
];

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { authState } = useAuth();
  const [showSignupDialog, setShowSignupDialog] = useState(false);

  const pathname = location.pathname;

  // Hide on portal and results pages
  if (pathname.includes('/portal/') || pathname.includes('/live-portal/') || pathname.endsWith('/results')) {
    return null;
  }

  const getProfilePath = () => {
    if (authState.type === 'authenticated') {
      return authState.user.role === 'student' ? '/student/dashboard' : '/teacher/dashboard';
    }
    return '#';
  };

  const getLivePath = () => {
    if (authState.type === 'authenticated' && authState.user.role === 'student') {
      return '/student/live';
    }
    return '/mock-test/live';
  };

    const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    if (path === '/profile') {
        return pathname.startsWith('/student/') || pathname.startsWith('/teacher/');
    }
    if (path === '/mock-test') {
      return pathname.startsWith('/mock-test') && !pathname.startsWith('/mock-test/live');
    }
    if (path === '/mock-test/live') {
      return pathname.startsWith('/mock-test/live') || pathname.startsWith('/student/live');
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <nav className={styles.navContainer}>
        <div className={styles.navContent}>
          {navItems.map((item) => {
            const path = item.path === '/profile' ? getProfilePath() : item.path === '/mock-test/live' ? getLivePath() : item.path;
            const active = isActive(item.path);
            let Icon = item.icon;
            let label = item.label;

            // Handle unauthenticated state for Profile/Sign Up
            if (item.label === 'Profile' && authState.type !== 'authenticated') {
              label = 'Sign Up';
              Icon = UserPlus;

              return (
                <button
                  key="signup-trigger"
                  type="button"
                  className={styles.navItem}
                  onClick={() => setShowSignupDialog(true)}
                >
                  <div className={styles.iconWrapper}>
                    <Icon size={20} />
                  </div>
                  <span className={styles.label}>{label}</span>
                </button>
              );
            }

            // Special rendering for Profile item - show avatar when authenticated
            if (item.label === 'Profile' && authState.type === 'authenticated') {
            const { user } = authState;
            const fallback = user.displayName
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2) || 'U';
            
            return (
              <Link to={path} key={item.label} className={`${styles.navItem} ${active ? styles.active : ''}`}>
                <div className={styles.iconWrapper}>
                  <Avatar className={styles.profileAvatar}>
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback>{fallback}</AvatarFallback>
                  </Avatar>
                </div>
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          }

            return (
              <Link to={path} key={item.label} className={`${styles.navItem} ${active ? styles.active : ''}`}>
                <div className={styles.iconWrapper}>
                  <Icon size={20} />
                  {item.label === 'Live' && <span className={styles.liveDot}></span>}
                </div>
                <span className={styles.label}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AuthRoleSelectDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        type="signup"
        redirectTo={pathname + location.search}
      />
    </>
  );
};