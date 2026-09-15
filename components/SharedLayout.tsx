import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { AuthRoleSelectDialog } from "./AuthRoleSelectDialog";
import { AccountMenu } from "./AccountMenu";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ShoppingCart, ShoppingBag, Radio, Users, Search } from "lucide-react";
import { Footer } from "./Footer";
import { useCartItemsQuery } from "../helpers/useCartQuery";
import { MobileBottomNav } from "./MobileBottomNav";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { BRAND_FAVICON, getBrandLogo } from "../helpers/brandAssets";
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

const AuthNav: React.FC = () => {
  const { authState, logout } = useAuth();
  const location = useLocation();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  
  // Construct the current path with search params for redirectTo
  const currentPath = location.pathname + location.search;
  const redirectTo = currentPath !== "/" ? currentPath : undefined;

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
          onClick={() => setLoginDialogOpen(true)}
        >
          Log In
        </Button>
        <Button 
          className={styles.signupButton} 
          size="lg" 
          onClick={() => setSignupDialogOpen(true)}
        >
          Create Account
        </Button>

        <AuthRoleSelectDialog 
          open={loginDialogOpen} 
          onOpenChange={setLoginDialogOpen} 
          type="login" 
          redirectTo={redirectTo}
        />
        <AuthRoleSelectDialog 
          open={signupDialogOpen} 
          onOpenChange={setSignupDialogOpen} 
          type="signup" 
          redirectTo={redirectTo}
        />
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

  // Scroll detection for mobile header hide/show (mobile only)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show
  const isDarkMode = useDarkModeObserver();

  useEffect(() => {
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
      <header className={`${styles.header} ${isHeaderHidden ? styles.headerHidden : ''}`}>
        <div className={styles.headerContent}>
          <Link to="/" className={styles.logo}>
            <img 
              src={getBrandLogo(isDarkMode)}
              alt="Testkart" 
              className={styles.logoImage}
              width={140}
              height={44}
            />
          </Link>
                    <nav className={styles.nav}>
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
              to="/mock-test/live"
              className={({ isActive }) =>
                `${styles.navLink} ${styles.liveTestsLink} ${isActive ? styles.active : ""}`
              }
              aria-label="Live Competitions"
              title="Live Competitions"
            >
              <div className={styles.liveIndicatorWrapper}>
                <Radio size={20} className={styles.liveIcon} />
                <span className={styles.liveDot}></span>
              </div>
              <span>Live Competitions</span>
            </NavLink>
            <NavLink
              to="/study-notes"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              Study Notes
            </NavLink>
            <NavLink
              to="/course"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              Courses
            </NavLink>
          </nav>
          <div className={styles.headerActions}>
            <SearchButton />
            <ShopButton />
            <CartButton />
                        <div className={styles.themeSwitchDesktop}><ThemeModeSwitch /></div>
            <AuthNav />
          </div>
        </div>
      </header>
      <main className={`${styles.main} ${isMobileNavVisible ? styles.mainWithMobileNav : ''}`}>{children}</main>
      <Footer />
      <MobileBottomNav />
      </div>
    </>
  );
};