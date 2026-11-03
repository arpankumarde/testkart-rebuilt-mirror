import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  LayoutDashboard,
  Users,
  BarChart3,
  Star,
  UserCog,
  Settings,
  CreditCard,
  LogOut,
  X,
  ChevronRight,
  Tag,
  Library,
  FolderOpen,
  Trash2,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  Trophy,
  Headset,
  Gift,
  Megaphone,
  Building2,
  Plus,
} from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { Button } from './Button';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';
import { TeacherKindTile } from './TeacherKindTile';
import { useTeacherCreateChooser } from './TeacherCreateChooser';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { getBrandLogo, BRAND_FAVICON } from '../helpers/brandAssets';
import { teacherContentKind, type TeacherContentKind } from '../helpers/teacherContentKinds';
import { useTeacherDashboardOverview } from '../helpers/useTeacherDashboardOverview';
import type { TeacherAttentionCounts } from '../endpoints/teacher/dashboard/overview_GET.schema';
import styles from './TeacherSidebar.module.css';

const RAIL_KEY = 'teacher_sidebar_rail';
const EXPANDED_GROUPS_KEY = 'teacher_sidebar_expanded_groups';

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

type TeacherNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Content items draw their kind's colour tile instead of a plain icon. */
  kind?: TeacherContentKind;
  badge?: string;
  /** A live count from the overview's attention block, shown when above zero. */
  count?: { read: (attention: TeacherAttentionCounts) => number; noun: string };
  /** Hidden from team managers, who do not own the academy's money, plan or public profile. */
  ownerOnly?: boolean;
  /** For items that stay active across a whole flow, not just one path. */
  isActiveFor?: (pathname: string) => boolean;
};

type TeacherNavGroup = {
  key: string;
  /** Omitted for the Dashboard group, which needs no heading. */
  label?: string;
  /** Home and Content never collapse; they are the daily work. */
  alwaysOpen?: boolean;
  items: TeacherNavItem[];
};

const contentItem = (
  kind: TeacherContentKind,
  readCount: (attention: TeacherAttentionCounts) => number,
  isActiveFor: (pathname: string) => boolean
): TeacherNavItem => {
  const meta = teacherContentKind(kind);
  return {
    href: meta.listPath,
    label: meta.plural,
    kind,
    count: { read: readCount, noun: 'in review' },
    isActiveFor,
  };
};

const NAV_GROUPS: TeacherNavGroup[] = [
  {
    key: 'home',
    alwaysOpen: true,
    items: [
      { href: '/', label: 'Home', icon: Home },
      { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    alwaysOpen: true,
    items: [
      contentItem(
        'mock_test',
        (a) => a.reviewsPendingTests,
        (p) => p === '/teacher/test-series' || p.startsWith('/teacher/create-test') || p.startsWith('/teacher/test/')
      ),
      contentItem('course', (a) => a.reviewsPendingCourses, (p) => p.startsWith('/teacher/courses')),
      contentItem('digital_product', (a) => a.reviewsPendingProducts, (p) => p.startsWith('/teacher/products')),
      contentItem(
        'live_test',
        (a) => a.reviewsPendingLiveTests,
        (p) =>
          p === '/teacher/live-tests' || p.startsWith('/teacher/create-live-test') || p.startsWith('/teacher/live-test/')
      ),
      contentItem('bundle', (a) => a.reviewsPendingBundles, (p) => p.startsWith('/teacher/bundles')),
    ],
  },
  {
    key: 'library',
    label: 'Library',
    items: [
      {
        href: '/teacher/question-bank',
        label: 'Question bank',
        icon: Library,
        isActiveFor: (p) => p.startsWith('/teacher/question-bank'),
      },
      { href: '/teacher/assets', label: 'Asset library', icon: FolderOpen },
      { href: '/teacher/trash', label: 'Trash', icon: Trash2 },
    ],
  },
  {
    key: 'students',
    label: 'Students',
    items: [
      { href: '/teacher/students', label: 'Enrollments', icon: Users },
      { href: '/teacher/students/performance', label: 'Performance', icon: Trophy },
      { href: '/teacher/reviews', label: 'Reviews', icon: Star },
      { href: '/teacher/posts', label: 'Community posts', icon: Megaphone },
    ],
  },
  {
    key: 'grow',
    label: 'Grow',
    items: [
      { href: '/teacher/creator-bonus', label: 'Creator Bonus', icon: Gift, badge: 'New' },
      { href: '/teacher/promo-codes', label: 'Promo codes', icon: Tag },
      { href: '/teacher/analytics', label: 'Analytics', icon: TrendingUp, ownerOnly: true },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    items: [
      { href: '/teacher/earnings', label: 'Earnings', icon: BarChart3, ownerOnly: true },
      { href: '/teacher/subscription', label: 'Fees and billing', icon: CreditCard, ownerOnly: true },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { href: '/teacher/edit-profile', label: 'Profile', icon: UserCog, ownerOnly: true },
      {
        href: '/teacher/organizations',
        label: 'Organisations',
        icon: Building2,
        isActiveFor: (p) => p.startsWith('/teacher/organizations'),
      },
      { href: '/teacher/settings', label: 'Settings', icon: Settings, ownerOnly: true },
      {
        href: '/teacher/support',
        label: 'Contact support',
        icon: Headset,
        count: { read: (a) => a.supportUnread, noun: 'unread' },
      },
    ],
  },
];

const NavItemLink = ({
  item,
  rail,
  attention,
  onNavigate,
}: {
  item: TeacherNavItem;
  rail: boolean;
  attention: TeacherAttentionCounts | null;
  onNavigate: () => void;
}) => {
  const location = useLocation();
  const Icon = item.icon;
  const isActive = item.isActiveFor
    ? item.isActiveFor(location.pathname)
    : location.pathname === item.href;
  const count = item.count && attention ? item.count.read(attention) : 0;
  const countText = count > 0 && item.count ? `${count} ${item.count.noun}` : null;

  const link = (
    <NavLink
      to={item.href}
      className={`${styles.navLink} ${isActive ? styles.active : ''}`}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      aria-label={rail ? [item.label, countText].filter(Boolean).join(', ') : undefined}
      data-badge={item.badge || countText ? 'true' : undefined}
    >
      {item.kind ? (
        <TeacherKindTile kind={item.kind} size="sm" className={styles.navTile} />
      ) : (
        Icon && <Icon size={18} className={styles.navIcon} aria-hidden="true" />
      )}
      <span className={styles.navLabel}>{item.label}</span>
      {countText ? (
        <span className={styles.navCount} title={countText}>
          <span aria-hidden="true">{count}</span>
          <span className={styles.visuallyHidden}>{countText}</span>
        </span>
      ) : (
        item.badge && <span className={styles.navBadge}>{item.badge}</span>
      )}
    </NavLink>
  );

  if (!rail) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className={styles.railTooltip}>
        {item.label}
        {(countText || item.badge) && <span className={styles.railTooltipBadge}>{countText ?? item.badge}</span>}
      </TooltipContent>
    </Tooltip>
  );
};

interface TeacherSidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  // Opt-in initial state only — every existing caller omits this and keeps
  // getting the sidebar expanded by default, same as before. Used by the
  // full-page question editor to start collapsed and give the editor more
  // room; the collapse/expand toggle still works normally either way.
  defaultCollapsed?: boolean;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
  className,
  isMobileOpen = false,
  onMobileClose,
  defaultCollapsed = false,
}) => {
  const [rail, setRail] = useState(defaultCollapsed);
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const { authState, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkMode = useDarkModeObserver();
  const { openChooser } = useTeacherCreateChooser();

  const user = authState.type === 'authenticated' ? authState.user : null;
  const isManager = user?.role === 'teacher' && user.teacherRole === 'manager';
  // The Overview's own cached request; with the app-wide no-refetch-on-mount
  // default this is one fetch per session, shared with the dashboard.
  const { data: overview } = useTeacherDashboardOverview('30d', user?.role === 'teacher');
  const attention = overview?.attention ?? null;

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !(item.ownerOnly && isManager)),
      })).filter((group) => group.items.length > 0),
    [isManager]
  );

  // A route the editor forces collapsed stays collapsed; otherwise the
  // teacher's own remembered choice wins.
  useEffect(() => {
    if (defaultCollapsed) return;
    setRail(readJson<boolean>(RAIL_KEY, false));
  }, [defaultCollapsed]);

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
    readJson<Record<string, boolean>>(EXPANDED_GROUPS_KEY, {})
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

  const handleCreate = () => {
    onMobileClose?.();
    openChooser();
  };

  // One button in every mode: the rail hides only its label, so the mobile
  // drawer (never a rail) shows the full button even if the rail is remembered.
  const createButton = (
    <button type="button" className={styles.createButton} onClick={handleCreate}>
      <Plus size={18} aria-hidden="true" />
      <span className={styles.createLabel}>Create</span>
    </button>
  );

  const handleLogout = async () => {
    await logout();
    onMobileClose?.();
    navigate('/');
  };

  return (
    <aside
      className={`${styles.sidebar} ${rail ? styles.rail : ''} ${isMobileOpen ? styles.open : ''} ${className || ''}`}
      aria-label="Teacher navigation"
    >
      <div className={styles.sidebarHeader}>
        <Link to="/" className={styles.brand} aria-label="Testkart home" onClick={handleNavigate}>
          <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.logoImage} />
          <img src={BRAND_FAVICON} alt="" className={styles.brandMark} />
          <span className={styles.chip}>Teacher</span>
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

      <div className={styles.createRow}>
        {rail ? (
          <Tooltip>
            <TooltipTrigger asChild>{createButton}</TooltipTrigger>
            <TooltipContent side="right">Create</TooltipContent>
          </Tooltip>
        ) : (
          createButton
        )}
      </div>

      <nav className={styles.nav} aria-label="Teacher sections">
        {groups.map((group, index) => {
          const isExpanded = group.alwaysOpen || !!expandedGroups[group.key];

          if (rail) {
            return (
              <div key={group.key} className={styles.navGroup}>
                {index > 0 && <div className={styles.railDivider} aria-hidden="true" />}
                {group.items.map((item) => (
                  <NavItemLink key={item.href} item={item} rail attention={attention} onNavigate={handleNavigate} />
                ))}
              </div>
            );
          }

          return (
            <div key={group.key} className={styles.navGroup}>
              {group.label && group.alwaysOpen && <div className={styles.groupHeading}>{group.label}</div>}
              {group.label && !group.alwaysOpen && (
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

              {isExpanded && (
                <div className={styles.groupItems}>
                  {group.items.map((item) => (
                    <NavItemLink
                      key={item.href}
                      item={item}
                      rail={false}
                      attention={attention}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        {user && isManager && (
          <div className={styles.sidebarUser}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className={styles.sidebarUserAvatar} />
            ) : (
              <UserCircle size={30} className={styles.sidebarUserIcon} aria-hidden="true" />
            )}
            <span className={styles.sidebarUserMeta}>
              <span className={styles.sidebarUserName}>{user.displayName}</span>
              <span className={styles.sidebarUserRole}>Manager</span>
            </span>
          </div>
        )}
        {user && !isManager && (
          <Link to="/teacher/edit-profile" className={styles.sidebarUser} onClick={handleNavigate}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className={styles.sidebarUserAvatar} />
            ) : (
              <UserCircle size={30} className={styles.sidebarUserIcon} aria-hidden="true" />
            )}
            <span className={styles.sidebarUserMeta}>
              <span className={styles.sidebarUserName}>{user.displayName}</span>
              <span className={styles.sidebarUserRole}>Academy owner</span>
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
          <TooltipContent side="right">{rail ? 'Expand navigation' : 'Collapse navigation'}</TooltipContent>
        </Tooltip>
      </div>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="your teacher account"
      />
    </aside>
  );
};
