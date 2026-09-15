import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, RefreshCw, CheckCircle2 } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { postReconcileAllOrders } from "../endpoints/admin/orders/reconcile-all_POST.schema";
import type { AttentionCounts } from "../endpoints/admin/dashboard/overview_GET.schema";
import type { AdminRole } from "../helpers/AdminTypes";
import { adminAttention, AttentionTile } from "../helpers/adminAttention";
import { useInvalidateAdminOverview } from "../helpers/useAdminDashboardOverview";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminAttentionBand.module.css";

const COLLAPSED_KEY = "admin_attention_collapsed";

type Props = {
  attention: AttentionCounts | undefined;
  role: AdminRole;
  isLoading: boolean;
  className?: string;
};

const Tile = ({ tile }: { tile: AttentionTile }) => {
  const invalidate = useInvalidateAdminOverview();
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
  const Icon = tile.icon;

  return (
    <li className={styles.tile}>
      <Link to={tile.href} className={styles.tileLink}>
        <span className={styles.tileIcon}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className={styles.tileBody}>
          <span className={styles.tileHeadline}>
            <span className={styles.tileCount}>{adminFormat.count(tile.count)}</span>
            <span className={styles.tileTitle}>{tile.title}</span>
          </span>
          <span className={styles.tileDetail}>{tile.detail}</span>
        </span>
        <ChevronRight size={16} className={styles.tileChevron} aria-hidden="true" />
      </Link>
      {tile.canReconcile && (
        <button
          type="button"
          className={styles.tileAction}
          onClick={() => reconcile.mutate()}
          disabled={reconcile.isPending}
        >
          <RefreshCw size={14} className={reconcile.isPending ? styles.spin : undefined} aria-hidden="true" />
          {reconcile.isPending ? "Reconciling" : "Reconcile with PayU"}
        </button>
      )}
    </li>
  );
};

export const AdminAttentionBand = ({ attention, role, isLoading, className }: Props) => {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage unavailable: the band simply starts expanded.
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Preference resets next visit.
      }
      return next;
    });
  };

  const tiles = attention ? adminAttention.tiles(attention, role) : [];
  const total = tiles.reduce((sum, tile) => sum + tile.count, 0);
  const showSkeleton = isLoading && !attention;
  const summary =
    tiles.length > 0
      ? `${adminFormat.count(total)} across ${tiles.length} ${tiles.length === 1 ? "queue" : "queues"}`
      : attention
        ? "All clear"
        : "";

  return (
    <section className={`${styles.band} ${className ?? ""}`.trim()} aria-label="Needs attention">
      <div className={styles.head}>
        <span className={styles.chip}>Needs attention</span>
        {summary && <span className={styles.summary}>{summary}</span>}
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
        >
          {collapsed ? "Show" : "Hide"}
          <ChevronDown
            size={16}
            className={`${styles.toggleIcon} ${collapsed ? styles.toggleIconCollapsed : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id={bodyId}
        className={`${styles.body} ${collapsed ? styles.bodyCollapsed : ""}`}
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div className={styles.bodyInner}>
          {showSkeleton ? (
            <ul className={styles.tiles} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className={styles.tile}>
                  <Skeleton className={styles.skeletonTile} />
                </li>
              ))}
            </ul>
          ) : tiles.length === 0 ? (
            <div className={styles.allClear}>
              <CheckCircle2 size={28} className={styles.allClearIcon} aria-hidden="true" />
              <div>
                <p className={styles.allClearTitle}>All clear</p>
                <p className={styles.allClearText}>No payouts, verifications or messages are waiting on you.</p>
              </div>
            </div>
          ) : (
            <ul className={styles.tiles}>
              {tiles.map((tile) => (
                <Tile key={tile.key} tile={tile} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
