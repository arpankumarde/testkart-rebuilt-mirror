import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, User, GraduationCap, FileText, UserPlus, ShoppingBag, LayoutGrid } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { MORE_RESOURCES, isMoreResourcePath } from '../helpers/moreResources';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { AuthRoleSelectDialog } from './AuthRoleSelectDialog';
import { MoreResourcesMenu } from './MoreResourcesMenu';
import styles from './MobileBottomNav.module.css';

const navItems = [
  { path: '/course', label: 'Courses', icon: GraduationCap },
  { path: '/mock-test', label: 'Tests', icon: FileText },
  { path: '/live-test', label: 'Live', icon: Radio },
  { path: '/study-notes', label: 'Notes', icon: ShoppingBag },
  { path: '/more', label: 'More', icon: LayoutGrid },
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
    return '/live-test';
  };

    const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    if (path === '/profile') {
        return pathname.startsWith('/student/') || pathname.startsWith('/teacher/');
    }
    if (path === '/live-test') {
      return pathname.startsWith('/live-test') || pathname.startsWith('/student/live');
    }
    if (path === '/more') {
      return MORE_RESOURCES.some(({ href }) => isMoreResourcePath(pathname, href));
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <nav className={styles.navContainer}>
        <div className={styles.navContent}>
          {navItems.map((item) => {
            const path = item.path === '/profile' ? getProfilePath() : item.path === '/live-test' ? getLivePath() : item.path;
            const active = isActive(item.path);
            let Icon = item.icon;
            let label = item.label;

            // More opens a menu rather than a page.
            if (item.label === 'More') {
              return (
                <MoreResourcesMenu
                  key="more"
                  side="top"
                  align="end"
                  trigger={
                    <button type="button" className={`${styles.navItem} ${active ? styles.active : ''}`}>
                      <div className={styles.iconWrapper}>
                        <Icon size={20} />
                      </div>
                      <span className={styles.label}>{label}</span>
                    </button>
                  }
                />
              );
            }

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