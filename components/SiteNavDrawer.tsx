import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BookOpen, FileText, GraduationCap, LayoutDashboard, LogOut, Radio, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { getBrandLogo } from "../helpers/brandAssets";
import { MORE_RESOURCES, isMoreResourcePath } from "../helpers/moreResources";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import styles from "./SiteNavDrawer.module.css";

type DrawerLink = { to: string; label: string; icon: LucideIcon; end?: boolean; live?: boolean };

const PRIMARY_LINKS: DrawerLink[] = [
  { to: "/course", label: "Courses", icon: GraduationCap },
  { to: "/mock-test", label: "Test Series", icon: FileText, end: true },
  { to: "/live-test", label: "Live Competitions", icon: Radio, live: true },
  { to: "/study-notes", label: "Study Notes", icon: BookOpen },
];

const initialsOf = (name?: string | null) =>
  name?.trim().split(/\s+/).map((part) => part[0]).join("").substring(0, 2) || "U";

interface SiteNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: () => void;
  onSignup: () => void;
}

/** The navbar's slide-out menu below 1200px: every primary link, the More resources and the account actions. */
export const SiteNavDrawer: React.FC<SiteNavDrawerProps> = ({ open, onOpenChange, onLogin, onSignup }) => {
  const { pathname } = useLocation();
  const { authState, logout } = useAuth();
  const isDarkMode = useDarkModeObserver();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const handoff = useRef(false);

  useEffect(() => {
    onOpenChange(false);
    // Close on navigation only; onOpenChange is a stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Closes the drawer and opens another dialog without the drawer handing focus back to the hamburger.
  const handOff = (next: () => void) => {
    handoff.current = true;
    onOpenChange(false);
    next();
  };

  const close = () => onOpenChange(false);
  const user = authState.type === "authenticated" ? authState.user : null;
  const isStudent = user?.role === "student";
  const linkClass = ({ isActive }: { isActive: boolean }) => `${styles.link} ${isActive ? styles.active : ""}`;

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className={styles.overlay} />
          <DialogPrimitive.Content
            className={styles.drawer}
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              if (handoff.current) event.preventDefault();
              handoff.current = false;
            }}
          >
            <div className={styles.head}>
              <Link to="/" className={styles.brand} onClick={close} aria-label="Testkart home">
                <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.logo} width={140} height={44} />
              </Link>
              <DialogPrimitive.Title className={styles.srOnly}>Menu</DialogPrimitive.Title>
              <DialogPrimitive.Close className={styles.closeButton} aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            <div className={styles.body}>
              <nav aria-label="Main">
                <ul className={styles.list}>
                  {PRIMARY_LINKS.map(({ to, label, icon: Icon, end, live }) => (
                    <li key={to}>
                      <NavLink to={to} end={end} className={linkClass} onClick={close}>
                        <span className={styles.iconWrap} aria-hidden="true">
                          <Icon size={18} />
                          {live && <span className={styles.liveDot} />}
                        </span>
                        {label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <p className={styles.sectionLabel}>More</p>
              <ul className={styles.list}>
                {MORE_RESOURCES.map(({ href, label, icon: Icon }) => {
                  const isActive = isMoreResourcePath(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        to={href}
                        className={`${styles.link} ${isActive ? styles.active : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={close}
                      >
                        <span className={styles.iconWrap} aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {user && (
                <>
                  <p className={styles.sectionLabel}>Account</p>
                  <ul className={styles.list}>
                    <li>
                      <NavLink
                        to={isStudent ? "/student/dashboard" : "/teacher/dashboard"}
                        className={linkClass}
                        onClick={close}
                      >
                        <span className={styles.iconWrap} aria-hidden="true">
                          <LayoutDashboard size={18} />
                        </span>
                        Dashboard
                      </NavLink>
                    </li>
                  </ul>
                </>
              )}
            </div>

            <div className={styles.foot}>
              {authState.type === "unauthenticated" && (
                <>
                  <button type="button" className={styles.cta} onClick={() => handOff(onSignup)}>
                    Create Account
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => handOff(onLogin)}>
                    Log In
                  </button>
                </>
              )}
              {user && (
                <>
                  <div className={styles.user}>
                    <Avatar className={styles.userAvatar}>
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                      <AvatarFallback>{initialsOf(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <span className={styles.userText}>
                      <span className={styles.userName}>{user.displayName?.trim() || (isStudent ? "Student" : "Teacher")}</span>
                      {user.email && <span className={styles.userEmail}>{user.email}</span>}
                    </span>
                  </div>
                  <button type="button" className={styles.secondary} onClick={() => handOff(() => setLogoutOpen(true))}>
                    <LogOut size={18} aria-hidden="true" />
                    Log out
                  </button>
                </>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {user && (
        <LogoutConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          onConfirm={logout}
          panelLabel={`your ${isStudent ? "student" : "teacher"} account`}
        />
      )}
    </>
  );
};
