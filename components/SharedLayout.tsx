import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { AuthRoleSelectDialog } from "./AuthRoleSelectDialog";
import { AccountMenu } from "./AccountMenu";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ShoppingCart, Radio, Users, Search, ChevronDown, Menu, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { TeacherCreateChooserProvider, useTeacherCreateChooser } from "./TeacherCreateChooser";
import { SiteNavDrawer } from "./SiteNavDrawer";
import { Footer } from "./Footer";
import { useCartItemsQuery } from "../helpers/useCartQuery";
import { MobileBottomNav } from "./MobileBottomNav";
import { MoreResourcesMenu } from "./MoreResourcesMenu";
import { GuestCartSync } from "./GuestCartSync";
import { ContentReportBar } from "./ContentReportBar";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { getBrandLogo } from "../helpers/brandAssets";
import { BrandFavicons } from "../helpers/BrandFavicons";
import { ORGANIZATION_PATH_PATTERN } from "../helpers/organizationRoutes";
import { MORE_RESOURCES, isMoreResourcePath } from "../helpers/moreResources";
import styles from "./SharedLayout.module.css";



// Teachers get a Dashboard button in this slot instead.
const SearchButton: React.FC = () => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  if (authState.type === "authenticated" && authState.user.role === "teacher") {
    return null;
  }
  return (
    <Button 
      variant="ghost" 
      className={styles.searchButton} 
      onClick={() => navigate('/search')} 
      aria-label="Search"
    >
      <Search size={20} />
    </Button>
  );
};

// Teachers don't buy, so they get no cart; guests keep seeing none as before.
const CartButton: React.FC = () => {
  const { authState } = useAuth();

  if (authState.type !== "authenticated" || authState.user.role === "teacher") {
    return null;
  }

  return <CartLink />;
};

const CartLink: React.FC = () => {
  const { data: cartData } = useCartItemsQuery();
  const itemCount = cartData?.items?.length || 0;

  return (
    <Button asChild variant="ghost" className={styles.cartButton}>
      <Link to="/cart">
        <div className={styles.cartIconWrapper}>
          <ShoppingCart size={20} />
          {itemCount > 0 && (
            <span className={styles.cartBadge}>{itemCount}</span>
          )}
        </div>
      </Link>
    </Button>
  );
};

const TeacherNavCreateButton: React.FC = () => {
  const { openChooser } = useTeacherCreateChooser();
  return (
    <button type="button" className={styles.createButton} onClick={openChooser}>
      <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
      Create
    </button>
  );
};

const AuthNav: React.FC<{ onLogin: () => void; onSignup: () => void }> = ({ onLogin, onSignup }) => {
  const { authState, logout } = useAuth();

  if (authState.type === "loading") {
    return (
      <div className={styles.authLoading}>
        <Skeleton style={{ width: "80px", height: "2.5rem" }} />
        <Skeleton
          style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%" }}
        />
      </div>
    );
  }

  if (authState.type === "unauthenticated") {
    return (
      <>
        <Button 
          variant="ghost" 
          className={styles.loginButton} 
          onClick={onLogin}
        >
          Log In
        </Button>
        <Button 
          className={styles.signupButton} 
          size="lg" 
          onClick={onSignup}
        >
          Create Account
        </Button>
      </>
    );
  }

  const { user } = authState;

  // Teachers get one tray, styled like the main nav: Create (the console's "What do you want to
  // create?" chooser) and an avatar + "Dashboard" link in place of the account menu.
  if (user.role === "teacher") {
    const initials =
      user.displayName?.trim().split(/\s+/).map((part) => part[0]).join("").substring(0, 2) || "T";
    return (
      <TeacherCreateChooserProvider>
        <div className={styles.teacherTray}>
          <TeacherNavCreateButton />
          <Link to="/teacher/dashboard" className={styles.dashboardButton}>
            <Avatar className={styles.dashboardAvatar}>
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            Dashboard
          </Link>
        </div>
      </TeacherCreateChooserProvider>
    );
  }

  return (
    <AccountMenu
      role={user.role === "student" ? "student" : "teacher"}
      displayName={user.displayName}
      email={user.email}
      avatarUrl={user.avatarUrl}
      onLogout={logout}
      className={styles.accountTrigger}
    />
  );
};

export const SharedLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isMobileNavVisible = !pathname.includes('/portal/') && !pathname.includes('/live-portal/') && !pathname.endsWith('/results');
  // Organisation pages use a slimmer header on phones; tablet and desktop are unchanged.
  const isCompactHeader = ORGANIZATION_PATH_PATTERN.test(pathname);
  const isMoreActive = MORE_RESOURCES.some(({ href }) => isMoreResourcePath(pathname, href));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authDialog, setAuthDialog] = useState<"login" | "signup" | null>(null);
  const currentPath = pathname + location.search;
  const redirectTo = currentPath !== "/" ? currentPath : undefined;

  // Scroll detection for mobile header hide/show (mobile only)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show
  const isDarkMode = useDarkModeObserver();

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mobileMediaQuery = window.matchMedia('(max-width: 968px)');
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;

      // Always show header when near top of page
      if (currentScrollY < 100) {
        setIsHeaderHidden(false);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Only trigger if scroll difference exceeds threshold to prevent jitter
      if (Math.abs(scrollDifference) < scrollThreshold) {
        return;
      }

      // Scrolling down - hide header
      if (scrollDifference > 0) {
        setIsHeaderHidden(true);
      } 
      // Scrolling up - show header
      else {
        setIsHeaderHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        // Mobile: attach scroll listener
        window.addEventListener('scroll', handleScroll, { passive: true });
      } else {
        // Desktop: remove scroll listener and reset header visibility
        window.removeEventListener('scroll', handleScroll);
        setIsHeaderHidden(false);
        lastScrollY.current = 0;
      }
    };

    // Initial check
    handleMediaChange(mobileMediaQuery);

    // Listen for screen size changes
    mobileMediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      mobileMediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  return (
    <>
      <Helmet htmlAttributes={{ lang: "en" }}>
                <link rel="preconnect" href="https://cdn.testkart.in" />
        <link rel="preconnect" href="https://assets.floot.app" />
        <link rel="dns-prefetch" href="https://cdn.testkart.in" />
        <link rel="dns-prefetch" href="https://assets.floot.app" />
      </Helmet>
      <BrandFavicons />
      <div className={styles.layoutContainer}>
      <header
        className={`${styles.header} ${isCompactHeader ? styles.headerCompact : ''} ${isHeaderHidden ? styles.headerHidden : ''}`}
      >
        <div className={styles.headerContent}>
          <div className={styles.brandZone}>
            <Link to="/" className={styles.logo}>
              <img
                src={getBrandLogo(isDarkMode)}
                alt="Testkart"
                className={styles.logoImage}
                width={140}
                height={44}
              />
            </Link>
          </div>
          <nav className={styles.nav} aria-label="Main">
            <NavLink
              to="/course"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              Courses
            </NavLink>
            <NavLink
              to="/mock-test"
              end
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              Test Series
            </NavLink>
            {/* Tutors sits in the More menu (helpers/moreResources) instead of the top bar.
            <NavLink
              to="/expert"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              aria-label="Tutors"
              title="Tutors"
            >
              Tutors
            </NavLink>
            */}
            <NavLink
              to="/study-notes"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              Study Notes
            </NavLink>
            <MoreResourcesMenu
              openOnHover
              trigger={
                <button type="button" className={`${styles.navLink} ${styles.moreTrigger} ${isMoreActive ? styles.active : ""}`}>
                  More
                  <ChevronDown size={16} className={styles.moreChevron} aria-hidden="true" />
                </button>
              }
            />
          </nav>
          <div className={styles.headerActions}>
            <SearchButton />
            <CartButton />
                        <div className={styles.themeSwitch}><ThemeModeSwitch /></div>
            <span className={styles.actionsDivider} aria-hidden="true" />
            <AuthNav onLogin={() => setAuthDialog("login")} onSignup={() => setAuthDialog("signup")} />
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <SiteNavDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLogin={() => setAuthDialog("login")}
        onSignup={() => setAuthDialog("signup")}
      />
      <AuthRoleSelectDialog
        open={authDialog === "login"}
        onOpenChange={(open) => setAuthDialog(open ? "login" : null)}
        type="login"
        redirectTo={redirectTo}
      />
      <AuthRoleSelectDialog
        open={authDialog === "signup"}
        onOpenChange={(open) => setAuthDialog(open ? "signup" : null)}
        type="signup"
        redirectTo={redirectTo}
      />
      <main
        className={`${styles.main} ${isMobileNavVisible ? styles.mainWithMobileNav : ''} ${isCompactHeader ? styles.mainCompactHeader : ''}`}
      >
        {children}
        <ContentReportBar />
      </main>
      <Footer />
      <MobileBottomNav />
      <GuestCartSync />
      </div>
    </>
  );
};