import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { AuthRoleSelectDialog } from "./AuthRoleSelectDialog";
import { AccountMenu } from "./AccountMenu";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ShoppingCart, ShoppingBag, Radio, Users, Search, ChevronDown, Menu } from "lucide-react";
import { SiteNavDrawer } from "./SiteNavDrawer";
import { Footer } from "./Footer";
import { useCartItemsQuery } from "../helpers/useCartQuery";
import { MobileBottomNav } from "./MobileBottomNav";
import { MoreResourcesMenu } from "./MoreResourcesMenu";
import { DiwaliSiteLayer } from "./DiwaliSiteLayer";
import { SpinWinLauncher } from "./SpinWinLauncher";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { BRAND_FAVICON, getBrandLogo } from "../helpers/brandAssets";
import { ORGANIZATION_PATH_PATTERN } from "../helpers/organizationRoutes";
import { MORE_RESOURCES, isMoreResourcePath } from "../helpers/moreResources";
import styles from "./SharedLayout.module.css";



const SearchButton: React.FC = () => {
  const navigate = useNavigate();
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

const ShopButton: React.FC = () => {
  return (
    <Button asChild variant="ghost" className={styles.shopButton}>
      <Link to="/study-notes" aria-label="Shop">
        <ShoppingBag size={20} />
      </Link>
    </Button>
  );
};

const CartButton: React.FC = () => {
  const { authState } = useAuth();
  const { data: cartData } = useCartItemsQuery();
  
  if (authState.type !== "authenticated") {
    return null;
  }

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
        
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>
      <div className={styles.layoutContainer}>
      <DiwaliSiteLayer />
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
            <NavLink
              to="/live-test"
              className={({ isActive }) =>
                `${styles.navLink} ${styles.liveTestsLink} ${isActive ? styles.active : ""}`
              }
              aria-label="Live Competitions"
              title="Live Competitions"
            >
              <div className={styles.liveIndicatorWrapper}>
                <Radio size={16} strokeWidth={2.25} className={styles.liveIcon} />
                <span className={styles.liveDot}></span>
              </div>
              <span className={styles.liveLabel}>Live Competitions</span>
            </NavLink>
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
            <ShopButton />
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
      </main>
      <Footer />
      <MobileBottomNav />
      <SpinWinLauncher />
      </div>
    </>
  );
};