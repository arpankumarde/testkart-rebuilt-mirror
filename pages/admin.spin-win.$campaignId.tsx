import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Pause, Pencil, Play, Rocket, Trash2, Undo2 } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { SpinPhaseBadge } from "../components/SpinWinBadges";
import { SpinWinCampaignDialog } from "../components/SpinWinCampaignDialog";
import { SpinWinRewardsPanel } from "../components/SpinWinRewardsPanel";
import { SpinWinCouponsPanel } from "../components/SpinWinCouponsPanel";
import { SpinWinSpinsPanel } from "../components/SpinWinSpinsPanel";
import { SpinWinAnalyticsPanel } from "../components/SpinWinAnalyticsPanel";
import { useDeleteSpinCampaign, useSpinCampaign, useSpinCampaignStatus } from "../helpers/useSpinWinAdmin";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { spinDateTime } from "../helpers/spinWinFormat";
import { durationLabel, formatInZone, SPIN_CATEGORY_LABELS, SPIN_FUNDING_LABELS, type SpinCategory } from "../helpers/spinWinRules";
import type { AdminSpinAuditEntry } from "../endpoints/admin/spin-win/campaign_GET.schema";
import type { AdminSpinCampaign } from "../helpers/spinWinAdmin";
import type { InputType as StatusInput } from "../endpoints/admin/spin-win/campaign-status_POST.schema";
import styles from "./admin.spin-win.$campaignId.module.css";

const TABS = ["rewards", "coupons", "spins", "analytics", "finance", "settings", "audit"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  rewards: "Rewards",
  coupons: "Coupons",
  spins: "Spin history",
  analytics: "Analytics",
  finance: "Finance",
  settings: "Settings",
  audit: "Audit log",
};

type Action = StatusInput["action"] | "delete";

const CONFIRM: Record<Action, { title: string; description: string; label: string; destructive?: boolean }> = {
  publish: { title: "Publish this campaign?", description: "Students can spin from the start time. The slug locks once published.", label: "Publish" },
  pause: { title: "Pause spins?", description: "No new spins until you resume. Issued coupons keep working.", label: "Pause" },
  resume: { title: "Resume spins?", description: "Spins open again straight away if the campaign is within its dates.", label: "Resume" },
  complete: {
    title: "Complete this campaign?",
    description: "Spins stop for good. Issued coupons stay valid until they expire. This cannot be undone.",
    label: "Complete campaign",
    destructive: true,
  },
  unpublish: { title: "Move back to draft?", description: "Nobody has spun yet, so the campaign can return to draft for changes.", label: "Move to draft" },
  delete: { title: "Delete this draft?", description: "The campaign and its rewards are removed. This cannot be undone.", label: "Delete campaign", destructive: true },
};

const yesNo = (value: boolean) => (value ? "Yes" : "No");

function changedKeys(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a).filter((k) => !["updatedAt", "updatedByAdminId", "updated_at"].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

const SettingsSummary: React.FC<{ campaign: AdminSpinCampaign; onEdit: () => void }> = ({ campaign, onEdit }) => {
  const tz = campaign.timezone;
  const facts: [string, React.ReactNode][] = [
    ["Starts", formatInZone(campaign.startsAt, tz)],
    ["Ends", formatInZone(campaign.endsAt, tz)],
    ["Duration", durationLabel(campaign.startsAt, campaign.endsAt)],
    ["Timezone", tz],
    ["Login required to spin", yesNo(campaign.loginRequiredToSpin)],
    ["Guests can spin", yesNo(campaign.allowGuestSpins)],
    ["Spins per account", "1"],
    ["Spins per guest session", campaign.allowGuestSpins ? "1" : "None"],
    ["Campaign spin limit", campaign.maxTotalSpins ? String(campaign.maxTotalSpins) : "No limit"],
    ["Claim deadline", campaign.claimDeadline ? formatInZone(campaign.claimDeadline, tz) : "Campaign end"],
    ["Coupons expire", campaign.redemptionDeadline ? formatInZone(campaign.redemptionDeadline, tz) : "Campaign end"],
    ["Applies to", campaign.eligibleCategories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ")],
    ["Maximum discount", `${campaign.maxDiscountPercent}% of the eligible cart`],
    ["Discount funding", SPIN_FUNDING_LABELS[campaign.discountFunding] ?? campaign.discountFunding],
  ];
  return (
    <div className={styles.settings}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Configuration</h2>
          <Button variant="outline" size="sm" onClick={onEdit} disabled={campaign.status === "completed"}>
            <Pencil size={14} /> Edit
          </Button>
        </div>
        {campaign.bannerUrl ? <img src={campaign.bannerUrl} alt="" className={styles.banner} /> : null}
        {campaign.description ? <p className={styles.description}>{campaign.description}</p> : null}
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Terms and conditions</h2>
        {campaign.terms ? <p className={styles.terms}>{campaign.terms}</p> : <p className={styles.muted}>No terms yet. Add them before publishing, with the real odds.</p>}
      </section>
    </div>
  );
};

const AuditLog: React.FC<{ entries: AdminSpinAuditEntry[] }> = ({ entries }) =>
  entries.length === 0 ? (
    <ConsoleListEmpty title="No changes yet" />
  ) : (
    <ol className={styles.audit}>
      {entries.map((entry) => {
        const keys = changedKeys(entry.before, entry.after);
        return (
          <li key={entry.id} className={styles.auditRow}>
            <span className={styles.auditWhen}>{spinDateTime(entry.createdAt)}</span>
            <span className={styles.auditWhat}>
              <strong>{entry.adminName ?? "An admin"}</strong> {entry.action.replace(/_/g, " ")} {entry.entity}
              {entry.entityId ? ` #${entry.entityId}` : ""}
              {keys.length > 0 ? <span className={styles.muted}> · {keys.join(", ")}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );

const AdminSpinWinCampaignPage: React.FC = () => {
  const { campaignId } = useParams();
  const id = Number(campaignId);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "rewards";
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<Action | null>(null);

  const query = useSpinCampaign(Number.isInteger(id) && id > 0 ? id : null);
  const status = useSpinCampaignStatus();
  const remove = useDeleteSpinCampaign();
  const data = query.data;
  const campaign = data?.campaign;

  const actions: { action: Action; icon: React.ReactNode; variant: "primary" | "outline" | "destructive" }[] = [];
  if (campaign) {
    if (campaign.status === "draft") {
      actions.push({ action: "publish", icon: <Rocket size={16} />, variant: "primary" });
      if (data.spins === 0) actions.push({ action: "delete", icon: <Trash2 size={16} />, variant: "outline" });
    }
    if (campaign.status === "published") actions.push({ action: "pause", icon: <Pause size={16} />, variant: "outline" });
    if (campaign.status === "paused") actions.push({ action: "resume", icon: <Play size={16} />, variant: "primary" });
    if (campaign.status === "published" || campaign.status === "paused") {
      if (data.spins === 0) actions.push({ action: "unpublish", icon: <Undo2 size={16} />, variant: "outline" });
      actions.push({ action: "complete", icon: <CheckCircle2 size={16} />, variant: "outline" });
    }
  }

  const runAction = () => {
    if (!confirming || !campaign) return;
    if (confirming === "delete") {
      remove.mutate(campaign.id, { onSuccess: () => navigate("/admin/spin-win") });
      return;
    }
    status.mutate({ id: campaign.id, action: confirming }, { onSettled: () => setConfirming(null) });
  };

  if (query.isError) {
    return (
      <div className={styles.page}>
        <ConsoleListEmpty tone="error" title="Campaign could not be loaded" description={parseErrorMessage(query.error)}>
          <Button variant="outline" asChild>
            <Link to="/admin/spin-win">Back to Spin & Win</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!data || !campaign) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "16rem" }} />
        <Skeleton style={{ height: "2.5rem", width: "100%" }} />
        <Skeleton style={{ height: "24rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${campaign.name} - Spin & Win - Testkart Admin`}</title>
        <meta name="description" content="Manage the campaign's wheel, coupons and results." />
      </Helmet>
      <div className={styles.page}>
        <Link to="/admin/spin-win" className={styles.back}>
          <ArrowLeft size={14} /> Spin & Win
        </Link>
        <ConsolePageHeader title={campaign.name}>
          {actions.map(({ action, icon, variant }) => (
            <Button key={action} variant={variant} onClick={() => setConfirming(action)}>
              {icon} {CONFIRM[action].label}
            </Button>
          ))}
        </ConsolePageHeader>

        <div className={styles.summary}>
          <SpinPhaseBadge phase={campaign.phase} />
          <span>
            {formatInZone(campaign.startsAt, campaign.timezone)} to {formatInZone(campaign.endsAt, campaign.timezone)}
          </span>
          <span className={styles.muted}>
            {durationLabel(campaign.startsAt, campaign.endsAt)} · {campaign.timezone} · /{campaign.slug}
          </span>
        </div>

        {campaign.status === "draft" && data.problems.length > 0 ? (
          <div className={styles.blockers} role="status">
            <strong>Before publishing:</strong> {data.problems.join(" ")}
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="rewards">
            <SpinWinRewardsPanel campaign={campaign} rewards={data.rewards} probabilityTotal={data.probabilityTotal} problems={data.problems} />
          </TabsContent>
          <TabsContent value="coupons">
            <SpinWinCouponsPanel campaignId={campaign.id} />
          </TabsContent>
          <TabsContent value="spins">
            <SpinWinSpinsPanel campaignId={campaign.id} />
          </TabsContent>
          <TabsContent value="analytics">
            <SpinWinAnalyticsPanel campaignId={campaign.id} view="performance" />
          </TabsContent>
          <TabsContent value="finance">
            <SpinWinAnalyticsPanel campaignId={campaign.id} view="finance" />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsSummary campaign={campaign} onEdit={() => setEditing(true)} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLog entries={data.audit} />
          </TabsContent>
        </Tabs>
      </div>

      <SpinWinCampaignDialog open={editing} onOpenChange={setEditing} campaign={campaign} />
      <ConsoleConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? CONFIRM[confirming].title : ""}
        description={confirming ? CONFIRM[confirming].description : undefined}
        tone={confirming && CONFIRM[confirming].destructive ? "destructive" : "default"}
        confirmLabel={confirming ? CONFIRM[confirming].label : ""}
        isPending={status.isPending || remove.isPending}
        onConfirm={runAction}
      />
    </>
  );
};

export default AdminSpinWinCampaignPage;