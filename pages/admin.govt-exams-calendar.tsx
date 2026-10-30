import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  CircleHelp,
  ClipboardList,
  EyeOff,
  FilePenLine,
  Hourglass,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/DropdownMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { GecAdminHeader } from "../components/GecAdminHeader";
import { GecImportExport } from "../components/GecImportExport";
import { GovtExamsStatus } from "../components/GovtExamsTable";
import type { GecAdminRow, GecAdminTab } from "../helpers/gecServer";
import { GEC_ADMIN_PATH, GEC_CATEGORIES, GEC_STATUSES, GEC_VERIFICATIONS, gecBlock, gecLabel, type GecSectionId } from "../helpers/gecModel";
import { gecDaysBetween, gecMonthLabel } from "../helpers/gecView";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import {
  useAdminGecList,
  useDeleteGecExam,
  useExtendGecDeadline,
  useGecVisibility,
  useVerifyGecExams,
} from "../helpers/useAdminGovtExamsCalendar";
import styles from "./admin.govt-exams-calendar.module.css";

const ALL = "__all";
const PAGE_SIZE = 25;

const TABS: { value: GecAdminTab; label: string }[] = [
  { value: "all", label: "All Exams" },
  { value: "next30", label: "Next 30 Days" },
  { value: "upsc", label: "UPSC" },
  { value: "ssc", label: "SSC" },
  { value: "banking", label: "Banking" },
  { value: "railway", label: "Railway" },
  { value: "state", label: "State Exams" },
  { value: "open", label: "Open Applications" },
  { value: "concluded", label: "Recently Concluded" },
];

const SECTION_SHORT: Partial<Record<GecSectionId, string>> = {
  "next-30-days": "Next 30",
  "upsc-2027": "UPSC",
  "ssc-2026-27": "SSC",
  "banking-ibps": "Banking",
  "railway-rrb": "Railway",
  "state-exams": "State",
  "open-applications": "Open apps",
  "recently-concluded": "Concluded",
};

const isTab = (value: string | null): value is GecAdminTab => TABS.some((tab) => tab.value === value);

const VerificationBadge: React.FC<{ row: GecAdminRow }> = ({ row }) => {
  const Icon = row.verification === "verified" ? ShieldCheck : row.verification === "needs_update" ? ShieldAlert : CircleHelp;
  return (
    <span className={`${styles.verify} ${styles[`verify_${row.verification}`]}`} title={row.verifiedAt ? `Verified ${adminFormat.relativeTime(row.verifiedAt)}` : undefined}>
      <Icon size={13} aria-hidden="true" />
      {gecLabel(GEC_VERIFICATIONS, row.verification)}
    </span>
  );
};

const KeyDate: React.FC<{ row: GecAdminRow; today: string | undefined }> = ({ row, today }) => {
  if (!row.keyDate) return <span className={styles.muted}>No dates yet</span>;
  const days = row.keyDate.deadline && today ? gecDaysBetween(today, row.keyDate.deadline) : null;
  const urgent = days !== null && days >= 0 && days <= 3;
  return (
    <span className={styles.keyDate}>
      <span className={`${styles.keyDateValue} ${urgent ? styles.urgent : ""}`}>{row.keyDate.label}</span>
      <span className={styles.keyDateDetail}>
        {row.keyDate.detail}
        {days !== null && days >= 0 && ` - ${days === 0 ? "closes today" : `${days} day${days === 1 ? "" : "s"} left`}`}
      </span>
    </span>
  );
};

const AdminGovtExamsCalendarPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = isTab(params.get("tab")) ? (params.get("tab") as GecAdminTab) : "all";
  const search = params.get("q") ?? "";
  const category = GEC_CATEGORIES.find((item) => item.value === params.get("category"))?.value;
  const status = GEC_STATUSES.find((item) => item.value === params.get("status"))?.value;
  const verification = GEC_VERIFICATIONS.find((item) => item.value === params.get("verification"))?.value;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : undefined;
  const year = /^\d{4}$/.test(params.get("year") ?? "") ? params.get("year")! : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const { data, isFetching, isError, error, refetch } = useAdminGecList({
    tab,
    search: search || undefined,
    category,
    status,
    verification,
    month,
    year,
    page,
    limit: PAGE_SIZE,
  });
  const verify = useVerifyGecExams();
  const visibility = useGecVisibility();
  const remove = useDeleteGecExam();
  const extend = useExtendGecDeadline();

  const [toDelete, setToDelete] = useState<GecAdminRow | null>(null);
  const [toExtend, setToExtend] = useState<GecAdminRow | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extendError, setExtendError] = useState<string | null>(null);

  const update = (changes: Record<string, string | undefined>, keepPage = false) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!keepPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const stats = data?.stats;
  const today = data?.meta.today;
  const filtered = !!(search || category || status || verification || month || year);
  const monthOptions = (() => {
    const yearsShown = data?.years ?? [];
    return yearsShown.flatMap((y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`));
  })();

  const CARDS = [
    { key: "total", label: "Total exams", value: stats?.total, icon: ClipboardList, tone: styles.toneLavender, onClick: () => update({ tab: undefined, status: undefined }) },
    { key: "upcoming", label: "Upcoming exams", value: stats?.upcoming, icon: CalendarClock, tone: styles.tonePowder, onClick: () => update({ tab: "next30" }) },
    { key: "open", label: "Open applications", value: stats?.openApplications, icon: CalendarCheck2, tone: styles.toneMint, onClick: () => update({ tab: "open" }) },
    { key: "tba", label: "Dates to be announced", value: stats?.tba, icon: Hourglass, tone: styles.toneButter, onClick: () => update({ tab: undefined, status: "tba" }) },
    { key: "concluded", label: "Recently concluded", value: stats?.recentlyConcluded, icon: CalendarX2, tone: styles.toneSage, onClick: () => update({ tab: "concluded" }) },
  ];

  const submitExtend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!toExtend?.keyDate?.eventId) return;
    setExtendError(null);
    try {
      await extend.mutateAsync({ eventId: toExtend.keyDate.eventId, date: extendDate, label: null });
      setToExtend(null);
    } catch (err) {
      setExtendError(parseErrorMessage(err));
    }
  };

  const renderActions = (row: GecAdminRow) => (
    <div className={styles.actions}>
      <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${row.name}`}>
        <Link to={`${GEC_ADMIN_PATH}/exam/${row.id}`}>
          <FilePenLine size={16} />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${row.name}`}>
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {tab === "open" && row.keyDate?.deadline && (
            <DropdownMenuItem
              onSelect={() => {
                setExtendDate(row.keyDate?.deadline ?? "");
                setExtendError(null);
                setToExtend(row);
              }}
            >
              <CalendarRange size={16} /> Extend last date
            </DropdownMenuItem>
          )}
          {row.verification !== "verified" && (
            <DropdownMenuItem onSelect={() => verify.mutate({ ids: [row.id], verification: "verified" })}>
              <ShieldCheck size={16} /> Mark verified
            </DropdownMenuItem>
          )}
          {row.verification !== "needs_update" && (
            <DropdownMenuItem onSelect={() => verify.mutate({ ids: [row.id], verification: "needs_update" })}>
              <ShieldAlert size={16} /> Flag as needing an update
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => visibility.mutate({ id: row.id, hidden: !row.isHidden })}>
            <EyeOff size={16} /> {row.isHidden ? "Show on public page" : "Hide from public page"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={styles.dangerItem} onSelect={() => setToDelete(row)}>
            <Trash2 size={16} /> Delete record
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const rows = data?.rows ?? [];

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.loading} aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} style={{ height: "3.5rem", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      );
    }
    if (isError && !data) {
      return (
        <ConsoleListEmpty tone="error" icon={<AlertCircle size={24} />} title="Could not load the calendar" description={parseErrorMessage(error)}>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      );
    }
    if (rows.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<CalendarRange size={24} />}
          title={filtered ? "Nothing matches these filters" : "Nothing in this tab right now"}
          description={filtered ? "Try a different search or clear the filters." : "Records appear here as their dates fall into this section."}
        >
          {filtered ? (
            <Button variant="outline" onClick={() => setParams(tab === "all" ? new URLSearchParams() : new URLSearchParams({ tab }), { replace: true })}>
              Clear filters
            </Button>
          ) : (
            <Button asChild>
              <Link to={`${GEC_ADMIN_PATH}/exam/new`}>
                <Plus size={16} /> Add Exam
              </Link>
            </Button>
          )}
        </ConsoleListEmpty>
      );
    }
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Exam / recruitment</th>
              <th scope="col">{tab === "open" ? "Last date" : tab === "concluded" ? "Held on" : tab === "next30" ? "Exam date" : "Key date"}</th>
              <th scope="col">Status</th>
              <th scope="col">On the public page</th>
              <th scope="col">Verification</th>
              <th scope="col">Updated</th>
              <th scope="col" className={styles.actionsHead}>
                <span className={styles.srOnly}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.isHidden ? styles.hiddenRow : undefined}>
                <td>
                  <Link to={`${GEC_ADMIN_PATH}/exam/${row.id}`} className={styles.nameLink}>
                    {row.name}
                  </Link>
                  <span className={styles.subline}>
                    <span className={styles.tag}>{gecLabel(GEC_CATEGORIES, row.category)}</span>
                    {row.conductingBody}
                    {row.recordType === "recruitment" && <span className={styles.tag}>Recruitment only</span>}
                    {row.isHidden && <span className={`${styles.tag} ${styles.tagHidden}`}>Hidden</span>}
                  </span>
                  {row.reviewNote && (
                    <span className={styles.review} title={row.reviewNote}>
                      <AlertCircle size={13} aria-hidden="true" /> Review note
                    </span>
                  )}
                </td>
                <td>
                  <KeyDate row={row} today={today} />
                </td>
                <td>
                  <GovtExamsStatus status={row.status} />
                </td>
                <td>
                  <span className={styles.sections}>
                    {row.sections.length === 0 ? (
                      <span className={styles.muted}>{row.isHidden ? "Hidden" : "Not listed today"}</span>
                    ) : (
                      row.sections.map((id) => (
                        <span key={id} className={styles.section} title={gecBlock(id)?.label}>
                          {SECTION_SHORT[id] ?? id}
                        </span>
                      ))
                    )}
                  </span>
                </td>
                <td>
                  <VerificationBadge row={row} />
                </td>
                <td className={styles.updated}>{row.updatedAt ? adminFormat.relativeTime(row.updatedAt) : "-"}</td>
                <td>{renderActions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Government Exams Calendar - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <GecAdminHeader>
          <GecImportExport />
          <Button asChild variant="outline">
            <Link to={`${GEC_ADMIN_PATH}/content`}>Edit page content</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`${GEC_ADMIN_PATH}/exam/new`}>
              <Plus size={16} /> Add Exam
            </Link>
          </Button>
        </GecAdminHeader>

        <section className={styles.stats} aria-label="Calendar overview">
          {CARDS.map(({ key, label, value, icon: Icon, tone, onClick }) => (
            <button key={key} type="button" className={`${styles.stat} ${tone}`} onClick={onClick}>
              <span className={styles.statIcon} aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className={styles.statValue}>{value === undefined ? "-" : adminFormat.count(value)}</span>
              <span className={styles.statLabel}>{label}</span>
            </button>
          ))}
        </section>

        {stats && stats.needsVerification > 0 && (
          <div className={styles.notice}>
            <ShieldAlert size={16} aria-hidden="true" />
            <span>
              <strong>{stats.needsVerification}</strong> record{stats.needsVerification === 1 ? "" : "s"} still need checking against the official notice.
              The imported data is a 2 November 2026 snapshot.
            </span>
            <Button variant="link" size="sm" onClick={() => update({ verification: verification ? undefined : "unverified" })}>
              {verification ? "Show all" : "Show unverified"}
            </Button>
          </div>
        )}

        <ConsoleListToolbar
          tabs={TABS.map((item) => ({ ...item, count: data?.tabCounts[item.value] }))}
          value={tab}
          onValueChange={(value) => update({ tab: value === "all" ? undefined : value })}
          tabsLabel="Calendar sections"
          panelId="gec-records"
          search={{
            value: search,
            onChange: (value) => update({ q: value.trim() || undefined }),
            placeholder: "Search exam, body, CEN or keyword",
            label: "Search calendar records",
          }}
        >
          <Select value={category ?? ALL} onValueChange={(value) => update({ category: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {GEC_CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status ?? ALL} onValueChange={(value) => update({ status: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {GEC_STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month ?? ALL} onValueChange={(value) => update({ month: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any month</SelectItem>
              {monthOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {gecMonthLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year ?? ALL} onValueChange={(value) => update({ year: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any year</SelectItem>
              {(data?.years ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={verification ?? ALL} onValueChange={(value) => update({ verification: value === ALL ? undefined : value })}>
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Verification">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any verification</SelectItem>
              {GEC_VERIFICATIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {isError && data && (
          <div className={styles.error} role="alert">
            The list could not be refreshed, so it may be out of date. {parseErrorMessage(error)}
          </div>
        )}

        <div id="gec-records" role="tabpanel" aria-busy={isFetching}>
          {renderContent()}
        </div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination page={page} totalPages={data.totalPages} onPageChange={(next) => update({ page: String(next) }, true)} />
        )}
      </div>

      <ConsoleConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this record?"
        description={
          <>
            <strong>{toDelete?.name}</strong> and all {toDelete?.eventCount ?? 0} of its dates will be removed from the draft. This cannot be undone. To keep it
            but take it off the page, hide it instead.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />

      <Dialog open={!!toExtend} onOpenChange={(open) => !open && setToExtend(null)}>
        <ConsoleDialogContent size="sm">
          <form onSubmit={submitExtend}>
            <ConsoleDialogHeader icon={<CalendarRange size={18} />} title="Extend the last date" description={toExtend?.name} />
            <ConsoleDialogBody className={styles.extendBody}>
              <label htmlFor="gec-extend-date" className={styles.fieldLabel}>
                New last date
              </label>
              <Input id="gec-extend-date" type="date" value={extendDate} min={today} onChange={(e) => setExtendDate(e.target.value)} required />
              <p className={styles.hint}>The row is marked Extended and stays in Open applications until this date passes.</p>
              {extendError && (
                <p className={styles.error} role="alert">
                  {extendError}
                </p>
              )}
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button variant="outline" onClick={() => setToExtend(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!extendDate || extend.isPending}>
                {extend.isPending ? "Saving..." : "Save new date"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};

export default AdminGovtExamsCalendarPage;