import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./Sheet";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ExternalLink, Ban } from "lucide-react";
import styles from "./AdminProductDetailPanel.module.css";

export interface AdminProductDetailStat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  /** Optional hint shown under the value, e.g. explaining what "worth publishing" means for this metric */
  helpText?: string;
}

interface AdminProductDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  productTypeLabel: string;
  statusBadge: React.ReactNode;
  /** true only when the product is actually reachable on its public URL right now */
  isLive: boolean;
  publicUrl: string | null;
  teacherName: string;
  price: number;
  createdAt: Date | string | null;
  stats: AdminProductDetailStat[];
  onUnpublish?: () => void;
  isUnpublishing?: boolean;
  unpublishLabel?: string;
  unpublishPendingLabel?: string;
}

const formatCurrency = (amount: number): string => `₹${amount.toLocaleString("en-IN")}`;
const formatDate = (date: Date | string | null): string => {
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(date));
};

export const AdminProductDetailPanel: React.FC<AdminProductDetailPanelProps> = ({
  open,
  onOpenChange,
  title,
  productTypeLabel,
  statusBadge,
  isLive,
  publicUrl,
  teacherName,
  price,
  createdAt,
  stats,
  onUnpublish,
  isUnpublishing = false,
  unpublishLabel = "Unpublish",
  unpublishPendingLabel = "Unpublishing...",
}) => {
  const hasActions = !!publicUrl || !!onUnpublish;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={styles.sheetContent}>
        <SheetHeader className={styles.header}>
          <SheetTitle className={styles.title}>{title}</SheetTitle>
          <SheetDescription asChild>
            <div className={styles.badgeRow}>
              {statusBadge}
              {isLive ? (
                <Badge variant="success">Live on public site</Badge>
              ) : (
                <Badge variant="outline">Not accessible publicly</Badge>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className={styles.body}>
          <dl className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <dt className={styles.infoLabel}>Type</dt>
              <dd className={styles.infoValue}>{productTypeLabel}</dd>
            </div>
            <div className={styles.infoRow}>
              <dt className={styles.infoLabel}>Teacher</dt>
              <dd className={styles.infoValue}>{teacherName}</dd>
            </div>
            <div className={styles.infoRow}>
              <dt className={styles.infoLabel}>Price</dt>
              <dd className={`${styles.infoValue} ${styles.figure}`}>{formatCurrency(price)}</dd>
            </div>
            <div className={styles.infoRow}>
              <dt className={styles.infoLabel}>Created</dt>
              <dd className={`${styles.infoValue} ${styles.figure}`}>{formatDate(createdAt)}</dd>
            </div>
          </dl>

          <section className={styles.section}>
            <div className={styles.sectionHeadings}>
              <h3 className={styles.sectionHeading}>Content added</h3>
              <p className={styles.sectionSubtext}>
                Use this to judge whether the product has enough content to be worth publishing.
              </p>
            </div>
            <div className={styles.statsGrid}>
              {stats.map((stat) => (
                <div key={stat.label} className={styles.statCard}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={styles.statValue}>
                    {stat.icon ? (
                      <span className={styles.statIcon} aria-hidden="true">
                        {stat.icon}
                      </span>
                    ) : null}
                    {stat.value}
                  </span>
                  {stat.helpText && <span className={styles.statHelp}>{stat.helpText}</span>}
                </div>
              ))}
            </div>
          </section>
        </div>

        {hasActions && (
          <SheetFooter className={styles.footer}>
            {publicUrl && (
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} />
                  View public page
                </a>
              </Button>
            )}
            {onUnpublish && (
              <Button variant="destructive" onClick={onUnpublish} disabled={isUnpublishing}>
                <Ban size={14} />
                {isUnpublishing ? unpublishPendingLabel : unpublishLabel}
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};
