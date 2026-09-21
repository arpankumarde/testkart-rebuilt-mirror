import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCircle,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { ADMIN_ROLE_LABELS } from "../helpers/AdminTypes";
import { AdminLayoutContext } from "../helpers/useAdminLayout";
import { adminNavigation, AdminNavGroup, AdminNavItem } from "../helpers/adminNavigation";
import { useAdminDashboardOverview } from "../helpers/useAdminDashboardOverview";
import { adminFormat } from "../helpers/adminFormat";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";
import { Button } from "./Button";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { BRAND_FAVICON, getBrandLogo } from "../helpers/brandAssets";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import styles from "./AdminDashboardLayout.module.css";

const EXPANDED_GROUPS_KEY = "admin_sidebar_expanded_groups";
const RAIL_KEY = "admin_sidebar_rail";

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; the preference simply resets next visit.
  }
};

const Brand = ({ isDarkMode, onClick }: { isDarkMode: boolean; onClick?: () => void }) => (
  <Link to="/" className={styles.brand} aria-label="Testkart home" onClick={onClick}>
    <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.logoImage} />
    <img src={BRAND_FAVICON} alt="" className={styles.brandMark} />
    <span className={styles.chip}>Admin</span>
  </Link>
);

const AdminHeader = ({
  onMenuToggle,
  onOpenPalette,
}: {
  onMenuToggle: () => void;
  onOpenPalette: () => void;
}) => {
  const { authState, logout } = useAdminAuth();
  const navigate = useNavigate();
  const isDarkMode = useDarkModeObserver();
  const [shortcut, setShortcut] = useState("Ctrl K");
  const [isLogoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K");
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Button
          variant="ghost"
          size="icon"
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </Button>
        <div className={styles.headerBrand}>
          <Brand isDarkMode={isDarkMode} />
        </div>
        <button type="button" className={styles.paletteTrigger} onClick={onOpenPalette}>
          <Search size={16} aria-hidden="true" />
          <span className={styles.paletteText}>Search pages and actions</span>
          <kbd className={styles.kbd}>{shortcut}</kbd>
        </button>
      </div>

      <div className={styles.headerRight}>
        <ThemeModeSwitch />
        {authState.type === "authenticated" && (
          <div className={styles.headerUser}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={styles.userMenuTrigger}>
                  {authState.admin.avatarUrl ? (
                    <img src={authState.admin.avatarUrl} alt="" className={styles.avatar} />
                  ) : (
                    <UserCircle size={22} aria-hidden="true" />
                  )}
                  <span className={styles.userMenuName}>{authState.admin.fullName}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.dropdownContent}>
                <DropdownMenuLabel className={styles.menuLabel}>
                  <span className={styles.menuName}>{authState.admin.fullName}</span>
                  <span className={styles.menuRole}>
                    {ADMIN_ROLE_LABELS[authState.admin.role] ?? authState.admin.role}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/profile" className={styles.menuItem}>
                    <UserCircle size={16} aria-hidden="true" />
                    My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className={styles.menuItem} onSelect={() => setLogoutOpen(true)}>
                  <LogOut size={16} aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="the admin panel"
      />
    </header>
  );
};

const NavItemLink = ({
  item,
  count,
  rail,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  count: number;
  rail: boolean;
  active: boolean;
  onNavigate: () => void;
}) => {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.href}
      className={`${styles.navLink} ${active ? styles.active : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      data-count={count > 0 ? "true" : undefined}
      aria-label={rail ? (count > 0 ? `${item.label}, ${count} pending` : item.label) : undefined}
    >
      <Icon size={18} className={styles.navIcon} aria-hidden="true" />
      <span className={styles.navLabel}>{item.label}</span>
      {count > 0 && <span className={styles.navCount}>{adminFormat.count(count)}</span>}
    </Link>
  );

  if (!rail) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className={styles.railTooltip}>
        {item.label}
        {count > 0 && <span className={styles.railTooltipCount}>{adminFormat.count(count)} pending</span>}
      </TooltipContent>
    </Tooltip>
  );
};

const AdminSidebar = ({
  isOpen,
  onClose,
  rail,
  onToggleRail,
  attention,
}: {
  isOpen: boolean;
  onClose: () => void;
  rail: boolean;
  onToggleRail: () => void;
  attention: AttentionCounts | undefined;
}) => {
  const { authState, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkMode = useDarkModeObserver();
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const permissions = authState.type === "authenticated" ? authState.admin.permissions ?? [] : null;
  const groups = adminNavigation.visibleGroups(permissions);

  const activeHref = adminNavigation.findByPath(location.pathname)?.href;
  const activeGroupKey = groups.find((group) => group.items.some((item) => item.href === activeHref))?.key;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    readJson<Record<string, boolean>>(EXPANDED_GROUPS_KEY, activeGroupKey ? { [activeGroupKey]: true } : {})
  );

  useEffect(() => {
    writeJson(EXPANDED_GROUPS_KEY, expandedGroups);
  }, [expandedGroups]);

  useEffect(() => {
    if (!activeGroupKey) return;
    setExpandedGroups((prev) => (prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  const toggleGroup = (key: string) => setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const navRef = useRef<HTMLElement>(null);
  const isActiveGroupExpanded = !!activeGroupKey && !!expandedGroups[activeGroupKey];

  useLayoutEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top >= navRect.top && linkRect.bottom <= navRect.bottom) return;
    nav.scrollTop += linkRect.top - navRect.top - (nav.clientHeight - linkRect.height) / 2;
  }, [location.pathname, rail, isActiveGroupExpanded]);

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate("/admin/login");
  };

  const renderGroup = (group: AdminNavGroup, index: number) => {
    const isOverview = group.key === "overview";
    const isExpanded = isOverview || !!expandedGroups[group.key];
    const groupCount = adminNavigation.groupCount(group, attention);

    if (rail) {
      return (
        <div key={group.key} className={styles.navGroup}>
          {index > 0 && <div className={styles.railDivider} aria-hidden="true" />}
          {group.items.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              count={adminNavigation.countFor(item, attention)}
              rail
              active={item.href === activeHref}
              onNavigate={onClose}
            />
          ))}
        </div>
      );
    }

    return (
      <div key={group.key} className={styles.navGroup}>
        {!isOverview && (
          <button
            type="button"
            className={styles.groupHeader}
            onClick={() => toggleGroup(group.key)}
            aria-expanded={isExpanded}
          >
            <span className={styles.groupLabel}>{group.label}</span>
            {!isExpanded && groupCount > 0 && (
              <span className={styles.navCount}>{adminFormat.count(groupCount)}</span>
            )}
            <ChevronRight
              size={14}
              className={`${styles.groupChevron} ${isExpanded ? styles.groupChevronOpen : ""}`}
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
                count={adminNavigation.countFor(item, attention)}
                rail={false}
                active={item.href === activeHref}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.sidebarHeader}>
          <Brand isDarkMode={isDarkMode} onClick={onClose} />
          <Button
            variant="ghost"
            size="icon"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} />
          </Button>
        </div>

        <nav ref={navRef} className={styles.nav} aria-label="Admin sections">
          {groups.map(renderGroup)}
        </nav>

        <div className={styles.sidebarFooter}>
          {authState.type === "authenticated" && (
            <>
              <Link to="/admin/profile" className={styles.sidebarUser} onClick={onClose}>
                {authState.admin.avatarUrl ? (
                  <img src={authState.admin.avatarUrl} alt="" className={styles.sidebarUserAvatar} />
                ) : (
                  <UserCircle size={30} className={styles.sidebarUserIcon} aria-hidden="true" />
                )}
                <span className={styles.sidebarUserMeta}>
                  <span className={styles.sidebarUserName}>{authState.admin.fullName}</span>
                  <span className={styles.sidebarUserRole}>
                    {ADMIN_ROLE_LABELS[authState.admin.role] ?? authState.admin.role}
                  </span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className={styles.sidebarLogout}
                onClick={() => setLogoutOpen(true)}
                aria-label="Log out"
              >
                <LogOut size={18} />
              </Button>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={styles.railToggle}
                onClick={onToggleRail}
                aria-label={rail ? "Expand navigation" : "Collapse navigation"}
                aria-pressed={rail}
              >
                {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{rail ? "Expand navigation" : "Collapse navigation"}</TooltipContent>
          </Tooltip>
        </div>
      </aside>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="the admin panel"
      />
    </>
  );
};

export const AdminDashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState } = useAdminAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rail, setRail] = useState(false);

  useEffect(() => {
    setRail(readJson<boolean>(RAIL_KEY, false));
  }, []);

  const toggleRail = useCallback(() => {
    setRail((prev) => {
      writeJson(RAIL_KEY, !prev);
      return !prev;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data: overview } = useAdminDashboardOverview("7d", authState.type === "authenticated");
  const attention = overview?.attention;

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <AdminLayoutContext.Provider value={{ setHeaderHidden }}>
      <Helmet>
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>
      <div className={`${styles.layout} ${rail ? styles.railLayout : ""}`}>
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          rail={rail}
          onToggleRail={toggleRail}
          attention={attention}
        />
        <div className={styles.mainContent}>
          {!headerHidden && (
            <AdminHeader
              onMenuToggle={() => setSidebarOpen((prev) => !prev)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          )}
          <main className={styles.pageContainer}>{children}</main>
        </div>
        <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} attention={attention} />
      </div>
    </AdminLayoutContext.Provider>
  );
};
