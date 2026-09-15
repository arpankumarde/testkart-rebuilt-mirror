import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Menu } from 'lucide-react';
import { StudentSidebar } from './StudentSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Button } from './Button';
import { MissingContactInfoDialog } from './MissingContactInfoDialog';
import { BRAND_FAVICON } from '../helpers/brandAssets';
import styles from './StudentDashboardLayout.module.css';

export const StudentDashboardLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
      
      {/* Mobile hamburger menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMobileSidebar}
        className={styles.mobileMenuButton}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </Button>

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