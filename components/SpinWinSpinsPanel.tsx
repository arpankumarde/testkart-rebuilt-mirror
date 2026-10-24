import React, { useState } from "react";
import { Disc3, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { ConsoleListToolbar, consoleToolbarControlClass } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Skeleton } from "./Skeleton";
import { SpinClaimBadge, SpinCouponBadge } from "./SpinWinBadges";
import { SpinCell, SpinWinDataTable, type SpinColumn } from "./SpinWinDataTable";
import { useSpinSpins } from "../helpers/useSpinWinAdmin";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { spinDateTime } from "../helpers/spinWinFormat";
import type { AdminSpinRow } from "../endpoints/admin/spin-win/spins_GET.schema";
import { downloadAdminSpinExport } from "../endpoints/admin/spin-win/export_GET.schema";
import styles from "./SpinWinSpinsPanel.module.css";

type Props = { campaignId?: number };

const CLAIM_TABS = [
  { value: "all", label: "All" },
  { value: "claimed", label: "Claimed" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "forfeited", label: "Forfeited" },
];

export const SpinWinSpinsPanel: React.FC<Props> = ({ campaignId }) => {
  const [claimStatus, setClaimStatus] = useState("all");
  const [spunAs, setSpunAs] = useState<"any" | "user" | "guest">("any");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const query = useSpinSpins({
    campaignId,
    page,
    search: search || undefined,
    claimStatus: claimStatus === "all" ? undefined : (claimStatus as "claimed" | "unclaimed" | "forfeited"),
    spunAs: spunAs === "any" ? undefined : spunAs,
  });
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const columns: SpinColumn<AdminSpinRow>[] = [
    {
      key: "who",
      header: "Student",
      hideInCard: true,
      render: (s) =>
        s.userId !== null ? (
          <SpinCell.Stack primary={s.studentName ?? `User #${s.userId}`} secondary={`#${s.userId} · ${s.studentEmail ?? s.studentMobile ?? ""}`} />
        ) : (
          <SpinCell.Stack primary="Guest" secondary={`Session ${s.sessionRef}`} />
        ),
    },
    { key: "as", header: "Spun as", width: "6.5rem", render: (s) => (s.spunAs === "guest" ? `Guest${s.sessionRef && s.userId !== null ? ` (${s.sessionRef})` : ""}` : "Logged in") },
    ...(campaignId ? [] : [{ key: "campaign", header: "Campaign", width: "10rem", render: (s: AdminSpinRow) => s.campaignName }]),
    { key: "when", header: "Spun at", width: "11rem", render: (s) => spinDateTime(s.spunAt) },
    { key: "reward", header: "Reward", width: "8rem", render: (s) => s.rewardName },
    { key: "claim", header: "Claim", width: "7rem", render: (s) => <SpinClaimBadge status={s.claimStatus} /> },
    {
      key: "coupon",
      header: "Coupon",
      width: "10rem",
      render: (s) =>
        s.couponCode ? (
          <span className={styles.couponCell}>
            <SpinCell.Code>{s.couponCode}</SpinCell.Code>
            {s.couponStatus ? <SpinCouponBadge status={s.couponStatus} /> : null}
          </span>
        ) : (
          <SpinCell.Muted>{s.claimStatus === "forfeited" ? "Account had spun" : "None"}</SpinCell.Muted>
        ),
    },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadAdminSpinExport({ kind: "spins", campaignId });
    } catch (error) {
      toast.error(parseErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <ConsoleListToolbar
        tabs={CLAIM_TABS}
        value={claimStatus}
        onValueChange={(value) => {
          setClaimStatus(value);
          setPage(1);
        }}
        tabsLabel="Claim status"
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Name, email, user ID, coupon or session",
          label: "Search spins",
        }}
      >
        <Select
          value={spunAs}
          onValueChange={(value) => {
            setSpunAs(value as typeof spunAs);
            setPage(1);
          }}
        >
          <SelectTrigger className={consoleToolbarControlClass} aria-label="Spun as">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Logged in and guest</SelectItem>
            <SelectItem value="user">Logged in</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          <Download size={16} /> {exporting ? "Exporting…" : "CSV"}
        </Button>
      </ConsoleListToolbar>

      {query.isError ? (
        <ConsoleListEmpty tone="error" icon={<Disc3 size={20} />} title="Spins could not be loaded" description={parseErrorMessage(query.error)}>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      ) : !data ? (
        <Skeleton style={{ height: "16rem", borderRadius: "var(--radius-md)" }} />
      ) : data.rows.length === 0 ? (
        <ConsoleListEmpty icon={<Disc3 size={20} />} title="No spins" description={search || claimStatus !== "all" || spunAs !== "any" ? "Nothing matches these filters." : "Spins appear here as students play."} />
      ) : (
        <>
          <SpinWinDataTable
            rows={data.rows}
            columns={columns}
            rowKey={(s) => s.id}
            caption="Spin history"
            busy={query.isFetching}
            cardTitle={(s) => columns[0].render(s)}
            cardAside={(s) => <SpinClaimBadge status={s.claimStatus} />}
          />
          <div className={styles.footer}>
            <span className={styles.count}>{adminFormat.count(data.total)} spins</span>
            {totalPages > 1 ? <ConsoleListPagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
          </div>
        </>
      )}
    </div>
  );
};