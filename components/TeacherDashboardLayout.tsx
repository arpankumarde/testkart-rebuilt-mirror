import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Menu, HelpCircle, Headset, BookOpen, LogOut, UserCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TeacherSidebar } from './TeacherSidebar';
import { Button } from './Button';
import { MissingContactInfoDialog } from './MissingContactInfoDialog';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { useAuth } from '../helpers/useAuth';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { BRAND_FAVICON, getBrandLogo } from '../helpers/brandAssets';
import styles from './TeacherDashboardLayout.module.css';

interface TeacherDashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  // Both opt-in and both default to the existing behavior, so every current
  // usage of this layout is unaffected. Used by the full-page question
  // editor to reclaim screen space: it hides the "need help?" bar and
  // starts the sidebar collapsed (the user can still expand it manually).
  hideSupportBar?: boolean;
  sidebarDefaultCollapsed?: boolean;
}

// Routes that want a distraction-free workspace (no "need help" bar, sidebar
// starts collapsed) without needing a pageLayout wrapper component — the
// framework requires pageLayout to render TeacherDashboardLayout directly
// with only `children`, so this is derived from the current path instead of
// passed in as a prop. Every other route falls through to the unchanged
// default layout.
//
// This covers every step screen of every "create/edit a product" flow, not
// just mock tests: the support/knowledge-base bar should only ever show on
// the home/dashboard and plain list pages, never while a teacher is heads-down
// building or editing something.
const FOCUSED_LAYOUT_ROUTE_PATTERNS: RegExp[] = [
  /^\/teacher\/create-test(\/.*)?$/, // mock test series: intake → details → items → subjects → questions → review/publish
  /^\/teacher\/live-test\/\d+\/questions\/?$/, // live test question workspace
  /^\/teacher\/courses\/create\/?$/,
  /^\/teacher\/courses\/\d+\/edit\/?$/,
  /^\/teacher\/courses\/\d+\/lessons\/\d+\/?$/,
  /^\/teacher\/bundles\/create\/?$/,
  /^\/teacher\/bundles\/\d+\/edit\/?$/,
  /^\/teacher\/products\/create\/?$/,
  /^\/teacher\/products\/\d+\/edit\/?$/,
];

export const TeacherDashboardLayout: React.FC<TeacherDashboardLayoutProps> = ({ children, className, hideSupportBar = false, sidebarDefaultCollapsed = false }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const isDarkMode = useDarkModeObserver();
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const user = authState.type === 'authenticated' ? authState.user : null;
  const isManager = user?.role === 'teacher' && user.teacherRole === 'manager';

  // Same sign-out as the sidebar footer: confirmed through LogoutConfirmDialog,
  // then back to the home page.
  const handleLogout = async () => {
    await logout();
    setIsMobileSidebarOpen(false);
    navigate('/');
  };
  const isFocusedRoute = FOCUSED_LAYOUT_ROUTE_PATTERNS.some((pattern) => pattern.test(location.pathname));
  const effectiveHideSupportBar = hideSupportBar || isFocusedRoute;
  const effectiveSidebarDefaultCollapsed = sidebarDefaultCollapsed || isFocusedRoute;

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <>
      <MissingContactInfoDialog />
      <Helmet>
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>

      {/* Mobile-only top bar: hamburger left, brand centred, an equal-width
          spacer on the right keeps the brand optically centred. Hidden above
          768px, where the sidebar is always visible. */}
      <header className={styles.mobileHeader}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobileSidebar}
          className={styles.mobileMenuButton}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </Button>
        <Link to="/" className={styles.mobileBrand} aria-label="Testkart home">
          <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.mobileLogo} />
          <span className={styles.mobileChip}>Teacher</span>
        </Link>
        {user ? (
          // modal={false}: the menu hands off to a Dialog, and a modal menu
          // would leave the body's pointer lock behind when it closes.
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.mobileProfileButton} aria-label="Account menu">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className={styles.mobileProfileAvatar} />
                ) : (
                  <UserCircle size={30} className={styles.mobileProfileIcon} aria-hidden="true" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.mobileProfileMenu}>
              <DropdownMenuLabel className={styles.mobileProfileMeta}>
                <span className={styles.mobileProfileName}>{user.displayName}</span>
                <span className={styles.mobileProfileRole}>{isManager ? 'Manager' : 'Academy owner'}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                <LogOut size={16} aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className={styles.mobileHeaderSpacer} aria-hidden="true" />
        )}
      </header>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="your teacher account"
      />

      {/* Backdrop overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className={styles.backdrop} 
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <div className={`${styles.layout} ${className || ''}`}>
      <TeacherSidebar 
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
        defaultCollapsed={effectiveSidebarDefaultCollapsed}
      />
      <main className={styles.mainContent}>
        {!effectiveHideSupportBar && (
          <div className={styles.supportBar}>
            <span className={styles.supportText}>
              <HelpCircle size={15} className={styles.supportIcon} aria-hidden="true" />
              Need help?
            </span>
            <nav className={styles.supportActions} aria-label="Help">
              <Link to="/help" target="_blank" rel="noopener noreferrer" className={styles.supportLink}>
                <BookOpen size={14} className={styles.supportActionIcon} aria-hidden="true" />
                Guides &amp; tutorials
              </Link>
              <Link to="/teacher/support" className={styles.supportLink}>
                <Headset size={14} className={styles.supportActionIcon} aria-hidden="true" />
                Contact support
              </Link>
            </nav>
          </div>
        )}
        <div className={styles.pageBody}>{children}</div>
      </main>
      </div>
    </>
  );
};