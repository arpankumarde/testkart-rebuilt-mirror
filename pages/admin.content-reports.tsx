import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Copyright,
  ExternalLink,
  Eye,
  Flag,
  Monitor,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  XCircle,
} from "lucide-react";
import type { ContentReportCategory, ContentReportStatus } from "../helpers/schema";
import {
  CONTENT_REPORT_CATEGORIES,
  CONTENT_REPORT_CATEGORY_LABELS,
  CONTENT_REPORT_STATUSES,
  CONTENT_REPORT_STATUS_LABELS,
  CONTENT_REPORT_TYPES,
  COPYRIGHT_CATEGORY,
  COPYRIGHT_MATERIAL_LABELS,
  type ContentReportType,
} from "../helpers/contentReportTypes";
import {
  useAdminContentReportReporterQuery,
  useAdminContentReportsQuery,
  useUpdateContentReportMutation,
} from "../helpers/useAdminContentReports";
import type { AdminContentReport } from "../endpoints/admin/content-reports/list_GET.schema";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Textarea } from "../components/Textarea";
import { Dialog } from "../components/Dialog";
import {
  ConsoleDialogBody,
  ConsoleDialogContent,
  ConsoleDialogFooter,
  ConsoleDialogHeader,
} from "../components/ConsoleDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import styles from "./admin.content-reports.module.css";

const PAGE_SIZE = 20;
const ALL = "all";

const STATUS_VARIANT: Record<ContentReportStatus, "warning" | "lavender" | "success" | "secondary"> = {
  new: "warning",
  under_review: "lavender",
  resolved: "success",
  dismissed: "secondary",
};

const typeLabel = (type: string): string =>
  CONTENT_REPORT_TYPES[type as ContentReportType] ?? type.replace(/_/g, " ");

const formatDate = (value: Date | string | null): string =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

const formatTime = (value: Date | string | null): string =>
  value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

const formatDateTime = (value: Date | string | null): string =>
  value ? `${formatDate(value)}, ${formatTime(value)}` : "Not recorded";

const StatusBadge: React.FC<{ status: ContentReportStatus }> = ({ status }) => (
  <Badge variant={STATUS_VARIANT[status]} className={styles.badge}>
    {CONTENT_REPORT_STATUS_LABELS[status]}
  </Badge>
);

/** Copyright reports stand out in the list: they are allegations that need an ownership check. */
const IssueLabel: React.FC<{ category: ContentReportCategory }> = ({ category }) =>
  category === COPYRIGHT_CATEGORY ? (
    <span className={styles.copyrightTag}>
      <Copyright size={12} aria-hidden="true" />
      Copyright
    </span>
  ) : (
    <>{CONTENT_REPORT_CATEGORY_LABELS[category]}</>
  );

const DetailRow: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div className={`${styles.detailItem} ${wide ? styles.detailWide : ""}`}>
    <dt className={styles.detailLabel}>{label}</dt>
    <dd className={styles.detailValue}>{children}</dd>
  </div>
);

const formatSubmittedAt = (value: Date | string): string =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={styles.copyButton}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            toast.success(`${label} copied`);
          })
          .catch(() => toast.error(`Could not copy the ${label.toLowerCase()}`))
      }
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </Button>
  );
};

const DEVICE_ICONS: Record<string, typeof Monitor> = { Desktop: Monitor, Mobile: Smartphone, Tablet };

/** IP and device captured on the server at submission. Fetched only when a report is opened. */
const ReporterInfoSection: React.FC<{ reportId: number }> = ({ reportId }) => {
  const { data, isLoading, error, refetch } = useAdminContentReportReporterQuery(reportId);
  const notRecorded = <span className={styles.muted}>Not recorded</span>;

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className={styles.details}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: "2.25rem", width: "100%" }} />
        ))}
      </div>
    );
  } else if (error || !data) {
    body = (
      <div className={styles.notesRow}>
        <span className={styles.small}>{error instanceof Error ? error.message : "Could not load the reporter details."}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  } else {
    const DeviceIcon = data.deviceType ? DEVICE_ICONS[data.deviceType] : undefined;
    body = (
      <dl className={styles.details}>
        <DetailRow label="IP address">
          {data.reporterIp ? (
            <span className={styles.copyRow}>
              <code className={styles.mono}>{data.reporterIp}</code>
              <CopyButton value={data.reporterIp} label="IP address" />
            </span>
          ) : (
            notRecorded
          )}
        </DetailRow>
        <DetailRow label="Submitted">{formatSubmittedAt(data.createdAt)}</DetailRow>
        <DetailRow label="Device type">
          {data.deviceType ? (
            <span className={styles.iconText}>
              {DeviceIcon && <DeviceIcon size={14} aria-hidden="true" />}
              {data.deviceType}
            </span>
          ) : (
            notRecorded
          )}
        </DetailRow>
        <DetailRow label="Operating system">{data.osName || notRecorded}</DetailRow>
        <DetailRow label="Browser">{data.browserName || notRecorded}</DetailRow>
        <DetailRow label="User agent" wide>
          {data.userAgent ? (
            <span className={styles.copyRow}>
              <code className={`${styles.mono} ${styles.userAgent}`}>{data.userAgent}</code>
              <CopyButton value={data.userAgent} label="User agent" />
            </span>
          ) : (
            notRecorded
          )}
        </DetailRow>
      </dl>
    );
  }

  return (
    <section className={styles.detailSection}>
      <h3 className={styles.sectionTitle}>Reporter information</h3>
      <p className={styles.privacyNote}>Captured automatically at submission. Visible to admins only.</p>
      {body}
    </section>
  );
};

const ReportDetailsDialog: React.FC<{ report: AdminContentReport | null; onClose: () => void }> = ({
  report,
  onClose,
}) => {
  const mutation = useUpdateContentReportMutation();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(report?.adminNotes ?? "");
  }, [report?.id, report?.adminNotes]);

  if (!report) return null;

  const setStatus = (status: ContentReportStatus) => mutation.mutate({ id: report.id, status });
  const notesChanged = notes.trim() !== (report.adminNotes ?? "").trim();
  const busy = mutation.isPending;
  const isCopyright = report.category === COPYRIGHT_CATEGORY;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          icon={<Flag size={18} />}
          title={`Report #${report.id}`}
          description={`${CONTENT_REPORT_CATEGORY_LABELS[report.category]} on ${typeLabel(report.contentType).toLowerCase()}`}
        >
          <div className={styles.headerBadges}>
            <StatusBadge status={report.status} />
            <span className={styles.headerMeta}>Reported {formatDateTime(report.createdAt)}</span>
          </div>
        </ConsoleDialogHeader>
        <ConsoleDialogBody>
          <section className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>Page</h3>
            <dl className={styles.details}>
              <DetailRow label="Title" wide>
                {report.pageTitle || "Untitled page"}
              </DetailRow>
              <DetailRow label="URL" wide>
                <a href={report.pageUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  {report.pageUrl}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </DetailRow>
              <DetailRow label="Content type">{typeLabel(report.contentType)}</DetailRow>
              <DetailRow label="Content ID">{report.contentId ?? "Not matched"}</DetailRow>
              <DetailRow label="Slug">
                {report.parentSlug ? `${report.parentSlug} / ` : ""}
                {report.contentSlug ?? "None"}
              </DetailRow>
              {report.detectedSection && <DetailRow label="Section (from highlight)">{report.detectedSection}</DetailRow>}
            </dl>
          </section>

          <section className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>{isCopyright ? "Copyright claim" : "Issue"}</h3>
            {isCopyright && (
              <p className={styles.claimNote}>
                This is an allegation from the reporter, not a confirmed violation. Check the ownership
                details before changing or removing any content.
              </p>
            )}
            <dl className={styles.details}>
              <DetailRow label="Category">{CONTENT_REPORT_CATEGORY_LABELS[report.category]}</DetailRow>
              {isCopyright ? (
                <>
                  <DetailRow label="Material type">
                    {report.copyrightMaterialType ? COPYRIGHT_MATERIAL_LABELS[report.copyrightMaterialType] : "Not given"}
                  </DetailRow>
                  <DetailRow label="Material location" wide>
                    {report.copyrightMaterialLocation || "Not given"}
                  </DetailRow>
                  <DetailRow label="Original source / ownership" wide>
                    {report.copyrightOriginalSource || <span className={styles.muted}>Not provided</span>}
                  </DetailRow>
                </>
              ) : (
                <DetailRow label="Specific location">{report.locationHint || "Not given"}</DetailRow>
              )}
              <DetailRow label="Description" wide>
                <span className={styles.message}>{report.description}</span>
              </DetailRow>
              {report.selectedText && (
                <DetailRow label="Highlighted text" wide>
                  <span className={`${styles.message} ${styles.quote}`}>{report.selectedText}</span>
                </DetailRow>
              )}
              {!isCopyright && (
                <DetailRow label="Suggested correction" wide>
                  {report.suggestedCorrection ? (
                    <span className={`${styles.message} ${styles.suggestion}`}>{report.suggestedCorrection}</span>
                  ) : (
                    <span className={styles.muted}>None suggested</span>
                  )}
                </DetailRow>
              )}
            </dl>
          </section>

          <section className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>Reporter contact</h3>
            <dl className={styles.details}>
              {isCopyright && <DetailRow label="Name">{report.reporterName || "Not given"}</DetailRow>}
              <DetailRow label="Email">
                {report.reporterEmail ? (
                  <a href={`mailto:${report.reporterEmail}`} className={styles.link}>
                    {report.reporterEmail}
                  </a>
                ) : (
                  <span className={styles.muted}>Anonymous</span>
                )}
              </DetailRow>
              <DetailRow label="Phone">
                {report.reporterPhone ? (
                  <a href={`tel:${report.reporterPhone.replace(/\s/g, "")}`} className={styles.link}>
                    {report.reporterPhone}
                  </a>
                ) : (
                  <span className={styles.muted}>Not given</span>
                )}
              </DetailRow>
              <DetailRow label="Signed-in user">
                {report.reporterUserId ? `${report.reporterUserName ?? "User"} (#${report.reporterUserId})` : "Visitor"}
              </DetailRow>
              <DetailRow label="Security check">
                {report.captchaVerifiedAt ? (
                  <span className={styles.verified}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    Passed {formatDateTime(report.captchaVerifiedAt)}
                  </span>
                ) : (
                  <span className={styles.muted}>Not recorded</span>
                )}
              </DetailRow>
            </dl>
          </section>

          <ReporterInfoSection reportId={report.id} />

          <section className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>Internal notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visible to admins only - what was checked, what was changed, why it was dismissed."
              rows={3}
              maxLength={5000}
              aria-label="Internal admin notes"
            />
            <div className={styles.notesRow}>
              <span className={styles.small}>
                {report.reviewedByName
                  ? `Last updated by ${report.reviewedByName}${report.statusChangedAt ? ` - status changed ${formatDateTime(report.statusChangedAt)}` : ""}`
                  : "Not reviewed yet"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!notesChanged || busy}
                onClick={() => mutation.mutate({ id: report.id, adminNotes: notes })}
              >
                Save notes
              </Button>
            </div>
          </section>
        </ConsoleDialogBody>
        <ConsoleDialogFooter className={styles.footer}>
          <Button variant="outline" asChild>
            <a href={report.pageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
              Open page
            </a>
          </Button>
          <div className={styles.footerActions}>
            {report.status !== "dismissed" && (
              <Button variant="ghost" disabled={busy} onClick={() => setStatus("dismissed")}>
                <XCircle size={16} />
                Dismiss
              </Button>
            )}
            {(report.status === "resolved" || report.status === "dismissed") && (
              <Button variant="outline" disabled={busy} onClick={() => setStatus("new")}>
                <RotateCcw size={16} />
                Reopen
              </Button>
            )}
            {report.status === "new" && (
              <Button variant="outline" disabled={busy} onClick={() => setStatus("under_review")}>
                <Search size={16} />
                Mark Under Review
              </Button>
            )}
            {report.status !== "resolved" && (
              <Button disabled={busy} onClick={() => setStatus("resolved")}>
                <CheckCircle2 size={16} />
                Mark Resolved
              </Button>
            )}
          </div>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const TableColumns = () => (
  <colgroup>
    <col className={styles.colId} />
    <col />
    <col className={styles.colType} />
    <col className={styles.colIssue} />
    <col className={styles.colDate} />
    <col className={styles.colStatus} />
    <col className={styles.colActions} />
  </colgroup>
);

const RowSkeleton = () => (
  <tr>
    {[60, 90, 70, 80, 70, 70, 60].map((w, i) => (
      <td key={i}>
        <Skeleton style={{ height: "0.875rem", width: `${w}%` }} />
      </td>
    ))}
  </tr>
);

const AdminContentReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(null);

  const status = (searchParams.get("status") || ALL) as ContentReportStatus | typeof ALL;
  const contentType = (searchParams.get("type") || ALL) as ContentReportType | typeof ALL;
  const category = (searchParams.get("category") || ALL) as ContentReportCategory | typeof ALL;
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const { data, isLoading, isFetching, error, refetch } = useAdminContentReportsQuery({
    status: status === ALL ? null : status,
    contentType: contentType === ALL ? null : contentType,
    category: category === ALL ? null : category,
    search: search || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  };

  const counts = data?.statusCounts;
  const allCount = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : undefined;
  const tabs = [
    { value: ALL, label: "All", count: allCount },
    ...CONTENT_REPORT_STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts?.[s.value] })),
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const openReport = data?.reports.find((r) => r.id === openId) ?? null;
  const filtersActive = contentType !== ALL || category !== ALL || !!search;

  const renderPageCell = (report: AdminContentReport) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine} title={report.pageTitle ?? undefined}>
        {report.pageTitle || "Untitled page"}
      </span>
      <a
        href={report.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.urlLine}
        title={report.pageUrl}
        onClick={(e) => e.stopPropagation()}
      >
        {report.pageUrl}
      </a>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={`${styles.tableContainer} ${styles.loadingTable}`} aria-busy="true">
          <table className={styles.table}>
            <TableColumns />
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the reports"
          description={error instanceof Error ? error.message : "Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.reports.length === 0) {
      const nothingAtAll = status === ALL && !filtersActive;
      return (
        <ConsoleListEmpty
          icon={<Flag size={24} />}
          title={nothingAtAll ? "No reports yet" : "No reports match these filters"}
          description={
            nothingAtAll
              ? "When a visitor uses Report an Issue on a public page, the report lands here with the page and section it came from."
              : "Try another status, content type or issue category."
          }
        >
          {!nothingAtAll && (
            <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams())}>
              Clear filters
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer} aria-busy={isFetching}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th>Report</th>
                <th>Page / Content</th>
                <th>Type</th>
                <th>Issue</th>
                <th>Reported on</th>
                <th>Status</th>
                <th className={styles.actionsHead}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((report) => (
                <tr key={report.id} className={styles.clickable} onClick={() => setOpenId(report.id)}>
                  <td className={styles.idCell}>#{report.id}</td>
                  <td>{renderPageCell(report)}</td>
                  <td>{typeLabel(report.contentType)}</td>
                  <td title={CONTENT_REPORT_CATEGORY_LABELS[report.category]}>
                    <IssueLabel category={report.category} />
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span>{formatDate(report.createdAt)}</span>
                      <span className={styles.secondaryLine}>{formatTime(report.createdAt)}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={report.status} />
                  </td>
                  <td className={styles.actionsCell}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View report ${report.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(report.id);
                      }}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={report.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open the page for report ${report.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {data.reports.map((report) => (
            <article key={report.id} className={`${styles.card} ${styles.clickable}`} onClick={() => setOpenId(report.id)}>
              <div className={styles.cardHeader}>
                <span className={styles.idCell}>#{report.id}</span>
                <StatusBadge status={report.status} />
              </div>
              {renderPageCell(report)}
              <dl className={styles.cardStats}>
                <div>
                  <dt>Type</dt>
                  <dd>{typeLabel(report.contentType)}</dd>
                </div>
                <div>
                  <dt>Issue</dt>
                  <dd>
                    <IssueLabel category={report.category} />
                  </dd>
                </div>
                <div>
                  <dt>Reported</dt>
                  <dd>{formatDate(report.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Content reports - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader
          title="Content reports"
          description="Mistakes visitors reported on public pages. Reports never change content on their own."
        />

        <ConsoleListToolbar
          tabs={tabs}
          value={status}
          onValueChange={(value) => setParam("status", value)}
          tabsLabel="Report status"
          search={{
            value: search,
            onChange: (value) => setParam("q", value.trim() || null),
            placeholder: "Search title, URL, text, contact or #ID",
            label: "Search reports",
          }}
        >
          <Select value={contentType} onValueChange={(value) => setParam("type", value)}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Content type">
              <SelectValue placeholder="All content types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All content types</SelectItem>
              {(Object.keys(CONTENT_REPORT_TYPES) as ContentReportType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {CONTENT_REPORT_TYPES[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(value) => setParam("category", value)}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Issue category">
              <SelectValue placeholder="All issues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All issues</SelectItem>
              {CONTENT_REPORT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        <div className={styles.results}>{renderContent()}</div>

        {data && data.reports.length > 0 && totalPages > 1 && (
          <ConsoleListPagination page={page} totalPages={totalPages} onPageChange={(p) => setParam("page", String(p))} />
        )}
      </div>
      <ReportDetailsDialog report={openReport} onClose={() => setOpenId(null)} />
    </>
  );
};

export default AdminContentReports;