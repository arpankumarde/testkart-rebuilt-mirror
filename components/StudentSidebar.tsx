import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardCheck,
  Radio,
  FileText,
  BookOpenCheck,
  Award,
  Wallet,
  Receipt,
  UserCog,
  LogOut,
  X,
  ChevronRight,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useStudentProfileCompletion } from '../helpers/useStudentProfileCompletion';
import { Button } from './Button';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { getBrandLogo, BRAND_FAVICON } from '../helpers/brandAssets';
import styles from './StudentSidebar.module.css';

const RAIL_KEY = 'student_sidebar_rail';
const EXPANDED_GROUPS_KEY = 'student_sidebar_expanded_groups';

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; the preference simply resets next visit.
  }
};

type StudentNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  /** For items that stay active across a whole flow, not just one path. */
  isActiveFor?: (pathname: string) => boolean;
};

type StudentNavGroup = {
  key: string;
  label: string;
  /** The first group carries the daily work and never collapses, as in admin. */
  alwaysOpen?: boolean;
  items: StudentNavItem[];
};

const NAV_GROUPS: StudentNavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    alwaysOpen: true,
    items: [{ href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    key: 'learning',
    label: 'Learning',
    items: [
      {
        href: '/student/tests',
        label: 'Mock Tests',
        icon: ClipboardCheck,
        isActiveFor: (p) => p === '/student/tests' || p.startsWith('/student/tests/'),
      },
      { href: '/student/live', label: 'Live Mock Tests', icon: Radio },
      {
        href: '/student/shop',
        label: 'Study Notes & PDFs',
        icon: FileText,
        isActiveFor: (p) => p === '/student/shop' || p.startsWith('/student/shop/'),
      },
      {
        href: '/student/courses',
        label: 'Courses',
        icon: BookOpenCheck,
        isActiveFor: (p) => p === '/student/courses' || p.startsWith('/student/courses/'),
      },
      { href: '/student/certificates', label: 'Certificates', icon: Award },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { href: '/student/wallet', label: 'Wallet', icon: Wallet },
      { href: '/student/orders', label: 'Orders', icon: Receipt },
      { href: '/student/profile', label: 'Profile', icon: UserCog },
    ],
  },
];

/*
 * One tree for both modes: the rail is resolved entirely in CSS. Branching the
 * JSX on `rail` makes React tear down and rebuild every nav link on each toggle,
 * which is the defect that had to be chased out of the admin console.
 */
const NavItemLink = ({
  item,
  rail,
  onNavigate,
}: {
  item: StudentNavItem;
  rail: boolean;
  onNavigate: () => void;
}) => {
  const location = useLocation();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const Icon = item.icon;
  const isActive = item.isActiveFor
    ? item.isActiveFor(location.pathname)
    : location.pathname === item.href;

  return (
    <Tooltip
      open={rail && tooltipOpen}
      onOpenChange={(next) => {
        // Ignore hover state entirely when expanded, so the labelled sidebar
        // does not churn state on every pointer move.
        if (rail) setTooltipOpen(next);
      }}
    >
      <TooltipTrigger asChild>
        <NavLink
          to={item.href}
          className={`${styles.navLink} ${isActive ? styles.active : ''}`}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          aria-label={rail ? item.label : undefined}
          data-badge={item.badge ? 'true' : undefined}
        >
          <Icon size={18} className={styles.navIcon} aria-hidden="true" />
          <span className={styles.navLabel}>{item.label}</span>
          {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" className={styles.railTooltip}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
};

interface StudentSidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const StudentSidebar: React.FC<StudentSidebarProps> = ({
  className,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const [rail, setRail] = useState(false);
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const { authState, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkMode = useDarkModeObserver();
  const completion = useStudentProfileCompletion();

  const user = authState.type === 'authenticated' ? authState.user : null;

  // The profile row carries the outstanding count, so the nudge is visible from
  // every page in the console and not only the dashboard.
  const groups = useMemo(() => {
    const outstanding = completion.isReady && !completion.isComplete ? completion.remaining.length : 0;
    if (outstanding === 0) return NAV_GROUPS;
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === '/student/profile' ? { ...item, badge: String(outstanding) } : item
      ),
    }));
  }, [completion.isReady, completion.isComplete, completion.remaining.length]);

  useEffect(() => {
    setRail(readJson<boolean>(RAIL_KEY, false));
  }, []);

  const toggleRail = () => {
    setRail((prev) => {
      writeJson(RAIL_KEY, !prev);
      return !prev;
    });
  };

  const activeGroupKey = groups.find((group) =>
    group.items.some((item) =>
      item.isActiveFor ? item.isActiveFor(location.pathname) : location.pathname === item.href
    )
  )?.key;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    readJson<Record<string, boolean>>(EXPANDED_GROUPS_KEY, { learning: true })
  );

  useEffect(() => {
    writeJson(EXPANDED_GROUPS_KEY, expandedGroups);
  }, [expandedGroups]);

  useEffect(() => {
    if (!activeGroupKey) return;
    setExpandedGroups((prev) => (prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleNavigate = () => onMobileClose?.();

  const handleLogout = async () => {
    await logout();
    onMobileClose?.();
    navigate('/');
  };

  const showMeter = completion.isReady && !completion.isComplete;

  return (
    <aside
      className={`${styles.sidebar} ${rail ? styles.rail : ''} ${isMobileOpen ? styles.open : ''} ${className || ''}`}
      aria-label="Student navigation"
    >
      <div className={styles.sidebarHeader}>
        <Link
          to="/"
          className={styles.brand}
          aria-label="Testkart home"
          onClick={handleNavigate}
        >
          <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.logoImage} />
          <img src={BRAND_FAVICON} alt="" className={styles.brandMark} />
          <span className={styles.chip}>Student</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={styles.closeButton}
          onClick={onMobileClose}
          aria-label="Close navigation"
        >
          <X size={20} />
        </Button>
      </div>

      <nav className={styles.nav} aria-label="Student sections">
        {groups.map((group, index) => {
          const isExpanded = group.alwaysOpen || !!expandedGroups[group.key];

          return (
            <div key={group.key} className={styles.navGroup}>
              {index > 0 && <div className={styles.railDivider} aria-hidden="true" />}

              {!group.alwaysOpen && (
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isExpanded}
                >
                  <span className={styles.groupLabel}>{group.label}</span>
                  <ChevronRight
                    size={14}
                    className={`${styles.groupChevron} ${isExpanded ? styles.groupChevronOpen : ''}`}
                    aria-hidden="true"
                  />
                </button>
              )}

              <div className={isExpanded ? styles.groupItems : styles.groupItemsCollapsed}>
                {group.items.map((item) => (
                  <NavItemLink key={item.href} item={item} rail={rail} onNavigate={handleNavigate} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {showMeter && (
        <Link to="/student/profile" className={styles.meter} onClick={handleNavigate}>
          <span className={styles.meterTop}>
            <span className={styles.meterLabel}>Profile</span>
            <span className={styles.meterValue}>{completion.percent}%</span>
          </span>
          <span
            className={styles.meterTrack}
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <span className={styles.meterFill} style={{ width: `${completion.percent}%` }} />
          </span>
          <span className={styles.meterHint}>
            {completion.remaining.length} step{completion.remaining.length === 1 ? '' : 's'} left
          </span>
        </Link>
      )}

      <div className={styles.sidebarFooter}>
        {user && (
          <Link to="/student/profile" className={styles.sidebarUser} onClick={handleNavigate}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className={styles.sidebarUserAvatar} />
            ) : (
              <UserCircle size={30} className={styles.sidebarUserIcon} aria-hidden="true" />
            )}
            <span className={styles.sidebarUserMeta}>
              <span className={styles.sidebarUserName}>{user.displayName}</span>
              <span className={styles.sidebarUserRole}>Student</span>
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={styles.sidebarLogout}
          onClick={() => setLogoutOpen(true)}
          aria-label="Log out"
        >
          <LogOut size={18} />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={styles.railToggle}
              onClick={toggleRail}
              aria-label={rail ? 'Expand navigation' : 'Collapse navigation'}
              aria-pressed={rail}
            >
              {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {rail ? 'Expand navigation' : 'Collapse navigation'}
          </TooltipContent>
        </Tooltip>
      </div>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="your student account"
      />
    </aside>
  );
};
