import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { StudentSidebar } from './StudentSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Button } from './Button';
import { MissingContactInfoDialog } from './MissingContactInfoDialog';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { BRAND_FAVICON, getBrandLogo } from '../helpers/brandAssets';
import styles from './StudentDashboardLayout.module.css';

export const StudentDashboardLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isDarkMode = useDarkModeObserver();

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
          <span className={styles.mobileChip}>Student</span>
        </Link>
        <span className={styles.mobileHeaderSpacer} aria-hidden="true" />
      </header>

      {/* Backdrop overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className={styles.backdrop} 
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <div className={`${styles.layout} ${className || ''}`}>
        <StudentSidebar 
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
};