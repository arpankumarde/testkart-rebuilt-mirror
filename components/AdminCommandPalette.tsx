import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, SunMoon, UserCircle, LogOut } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "./Command";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { adminNavigation } from "../helpers/adminNavigation";
import { adminAttention } from "../helpers/adminAttention";
import { adminFormat } from "../helpers/adminFormat";
import { getCurrentThemeMode, switchToDarkMode, switchToLightMode } from "../helpers/themeMode";
import { postReconcileAllOrders } from "../endpoints/admin/orders/reconcile-all_POST.schema";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";
import { useInvalidateAdminOverview } from "../helpers/useAdminDashboardOverview";
import { hasAdminModule } from "../helpers/adminPermissions";
import styles from "./AdminCommandPalette.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attention?: AttentionCounts;
};

/**
 * Ctrl+K / Cmd+K jump box for the admin panel: every page the admin can open,
 * the queues that currently need attention, and a few one-shot actions.
 */
export const AdminCommandPalette = ({ open, onOpenChange, attention }: Props) => {
  const { authState, logout } = useAdminAuth();
  const navigate = useNavigate();
  const invalidate = useInvalidateAdminOverview();
  const [isLogoutOpen, setLogoutOpen] = useState(false);
  const permissions = authState.type === "authenticated" ? authState.admin.permissions ?? [] : null;
  const groups = adminNavigation.visibleGroups(permissions);
  const tiles = attention ? adminAttention.tiles(attention, permissions) : [];
  const canReconcile = hasAdminModule(permissions, ["transactions"]);

  const reconcile = useMutation({
    mutationFn: () => postReconcileAllOrders({}),
    onSuccess: (result) => {
      toast.success(
        `Reconciled ${result.reconciled}, marked ${result.markedFailed} failed, ${result.stillPending} still pending`
      );
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Reconcile failed");
    },
  });

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const toggleTheme = () => {
    onOpenChange(false);
    if (getCurrentThemeMode() === "dark") switchToLightMode();
    else switchToDarkMode();
  };

  const runReconcile = () => {
    onOpenChange(false);
    toast.message("Reconciling pending orders with PayU");
    reconcile.mutate();
  };

  const askLogout = () => {
    onOpenChange(false);
    setLogoutOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search pages and actions" />
        <CommandList className={styles.list}>
          <CommandEmpty>No matches.</CommandEmpty>

          {tiles.length > 0 && (
            <CommandGroup heading="Needs attention">
              {tiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <CommandItem
                    key={tile.key}
                    value={`attention ${tile.title} ${tile.detail}`}
                    onSelect={() => go(tile.href)}
                  >
                    <Icon aria-hidden="true" />
                    <span className={styles.label}>
                      <span className={styles.count}>{adminFormat.count(tile.count)}</span> {tile.title}
                    </span>
                    <CommandShortcut>{tile.detail}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {groups.map((group) => (
            <CommandGroup key={group.key} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = adminNavigation.countFor(item, attention);
                return (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.label} ${item.keywords ?? ""}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon aria-hidden="true" />
                    <span className={styles.label}>{item.label}</span>
                    {count > 0 && <CommandShortcut>{adminFormat.count(count)} pending</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}

          <CommandGroup heading="Actions">
            {canReconcile && (
              <CommandItem value="reconcile stuck pending orders payu" onSelect={runReconcile}>
                <RefreshCw aria-hidden="true" />
                <span className={styles.label}>Reconcile stuck orders with PayU</span>
              </CommandItem>
            )}
            <CommandItem value="switch theme light dark mode" onSelect={toggleTheme}>
              <SunMoon aria-hidden="true" />
              <span className={styles.label}>Switch light or dark theme</span>
            </CommandItem>
            <CommandItem value="my profile account settings" onSelect={() => go("/admin/profile")}>
              <UserCircle aria-hidden="true" />
              <span className={styles.label}>My profile</span>
            </CommandItem>
            <CommandItem value="log out sign out" onSelect={askLogout}>
              <LogOut aria-hidden="true" />
              <span className={styles.label}>Log out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <LogoutConfirmDialog
        open={isLogoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        panelLabel="the admin panel"
      />
    </>
  );
};
