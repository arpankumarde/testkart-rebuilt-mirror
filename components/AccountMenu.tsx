import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, LogOut, Receipt, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import styles from "./AccountMenu.module.css";

export type AccountMenuRole = "student" | "teacher";

type AccountMenuLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Labels and icons match the student and teacher sidebars.
const LINKS: Record<AccountMenuRole, AccountMenuLink[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/profile", label: "Profile", icon: UserCog },
    { href: "/student/orders", label: "Orders", icon: Receipt },
  ],
  teacher: [
    { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/teacher/edit-profile", label: "Profile", icon: UserCog },
  ],
};

const ROLE_LABELS: Record<AccountMenuRole, string> = {
  student: "Student",
  teacher: "Teacher",
};

export interface AccountMenuProps {
  role: AccountMenuRole;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => Promise<void> | void;
  className?: string;
}

const getInitials = (name?: string | null) =>
  name
    ?.trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .substring(0, 2) || "U";

export const AccountMenu: React.FC<AccountMenuProps> = ({
  role,
  displayName,
  email,
  avatarUrl,
  onLogout,
  className,
}) => {
  const { pathname } = useLocation();
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const initials = getInitials(displayName);
  const name = displayName?.trim() || ROLE_LABELS[role];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`${styles.trigger} ${className ?? ""}`} aria-label="Account menu">
            <Avatar className={styles.triggerAvatar}>
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className={styles.content}>
          <DropdownMenuLabel className={styles.header}>
            <Avatar className={styles.headerAvatar}>
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className={styles.identity}>
              <span className={styles.nameRow}>
                <span className={styles.name}>{name}</span>
                <span className={styles.chip}>{ROLE_LABELS[role]}</span>
              </span>
              {email && <span className={styles.email}>{email}</span>}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className={styles.separator} />
          {LINKS[role].map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <DropdownMenuItem
                key={link.href}
                asChild
                className={`${styles.item} ${isActive ? styles.active : ""}`}
              >
                <Link to={link.href} aria-current={isActive ? "page" : undefined}>
                  <Icon size={16} className={styles.icon} aria-hidden="true" />
                  <span className={styles.label}>{link.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className={styles.separator} />
          <DropdownMenuItem className={styles.item} onSelect={() => setLogoutOpen(true)}>
            <LogOut size={16} className={styles.icon} aria-hidden="true" />
            <span className={styles.label}>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={onLogout}
        panelLabel={`your ${role} account`}
      />
    </>
  );
};
