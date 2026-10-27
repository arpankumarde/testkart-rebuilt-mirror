import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { BarChart3, CalendarRange, Disc3, Pencil, Plus, Ticket } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { SpinPhaseBadge } from "../components/SpinWinBadges";
import { SpinWinStatGrid, type SpinStatItem } from "../components/SpinWinStatGrid";
import { SpinWinCampaignDialog } from "../components/SpinWinCampaignDialog";
import { SpinChartGrid, SpinDailySpinsChart } from "../components/SpinWinCharts";
import { performanceItems } from "../components/SpinWinAnalyticsPanel";
import { useSpinCampaigns } from "../helpers/useSpinWinAdmin";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { durationLabel, formatInZone } from "../helpers/spinWinRules";
import type { AdminSpinCampaignRow } from "../endpoints/admin/spin-win/campaigns_GET.schema";
import styles from "./admin.spin-win.module.css";

const CampaignCard: React.FC<{ campaign: AdminSpinCampaignRow; onEdit: () => void }> = ({ campaign, onEdit }) => {
  const base = `/admin/spin-win/${campaign.id}`;
  const oddsOk = campaign.probabilityTotal === 100;
  return (
    <li className={styles.campaign}>
      <div className={styles.campaignHead}>
        <div className={styles.campaignTitle}>
          <Link to={base} className={styles.campaignName}>
            {campaign.name}
          </Link>
          <span className={styles.campaignSlug}>/{campaign.slug}</span>
        </div>
        <SpinPhaseBadge phase={campaign.phase} />
      </div>
      <p className={styles.dates}>
        <CalendarRange size={14} aria-hidden="true" />
        {formatInZone(campaign.startsAt, campaign.timezone)} to {formatInZone(campaign.endsAt, campaign.timezone)} · {durationLabel(campaign.startsAt, campaign.endsAt)}
      </p>
      <dl className={styles.figures}>
        <div>
          <dt>Spins</dt>
          <dd>{adminFormat.count(campaign.spins)}</dd>
        </div>
        <div>
          <dt>Coupons</dt>
          <dd>{adminFormat.count(campaign.coupons)}</dd>
        </div>
        <div>
          <dt>Redeemed</dt>
          <dd>{adminFormat.count(campaign.redeemed)}</dd>
        </div>
        <div>
          <dt>Rewards on</dt>
          <dd>{campaign.activeRewards}</dd>
        </div>
        <div>
          <dt>Odds</dt>
          <dd className={oddsOk ? undefined : styles.warn}>{campaign.probabilityTotal}%</dd>
        </div>
      </dl>
      <div className={styles.quick}>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil size={14} /> Edit
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`${base}?tab=rewards`}>
            <Disc3 size={14} /> Rewards
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`${base}?tab=coupons`}>
            <Ticket size={14} /> Coupons
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`${base}?tab=analytics`}>
            <BarChart3 size={14} /> Analytics
          </Link>
        </Button>
      </div>
    </li>
  );
};

const AdminSpinWinPage: React.FC = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminSpinCampaignRow | null>(null);
  const query = useSpinCampaigns({ from: from || undefined, to: to || undefined });
  const data = query.data;

  const statItems: SpinStatItem[] = data
    ? [
        ...performanceItems(data.stats),
        { label: "Testkart margin after discount", value: adminFormat.inr(data.finance.marginCurrent), note: "current settlement", tone: "sage" },
      ]
    : [];

  return (
    <>
      <Helmet>
        <title>Spin & Win - Testkart Admin</title>
        <meta name="description" content="Spin & Win campaigns, rewards, coupons and results." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Spin & Win">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New campaign
          </Button>
        </ConsolePageHeader>

        <div className={styles.range}>
          <label className={styles.dateField}>
            <span>From</span>
            <Input type="date" value={from || data?.range.startDay || ""} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={styles.dateField}>
            <span>To</span>
            <Input type="date" value={to || data?.range.endDay || ""} onChange={(e) => setTo(e.target.value)} />
          </label>
          {from || to ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Last 30 days
            </Button>
          ) : (
            <span className={styles.rangeNote}>All campaigns, last 30 days</span>
          )}
        </div>

        {query.isError ? (
          <ConsoleListEmpty tone="error" title="Spin & Win could not be loaded" description={parseErrorMessage(query.error)}>
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        ) : !data ? (
          <>
            <Skeleton style={{ height: "12rem", borderRadius: "var(--radius-md)" }} />
            <Skeleton style={{ height: "16rem", borderRadius: "var(--radius-md)" }} />
          </>
        ) : (
          <>
            <SpinWinStatGrid items={statItems} label="Campaign statistics" />

            <section className={styles.section} aria-labelledby="spin-campaigns">
              <h2 id="spin-campaigns" className={styles.sectionTitle}>
                Campaigns
              </h2>
              {data.campaigns.length === 0 ? (
                <ConsoleListEmpty icon={<Disc3 size={20} />} title="No campaigns yet" description="Create a campaign to set up the wheel.">
                  <Button onClick={() => setCreating(true)}>
                    <Plus size={16} /> New campaign
                  </Button>
                </ConsoleListEmpty>
              ) : (
                <ul className={styles.campaigns}>
                  {data.campaigns.map((c) => (
                    <CampaignCard key={c.id} campaign={c} onEdit={() => setEditing(c)} />
                  ))}
                </ul>
              )}
            </section>

            <SpinChartGrid>
              <SpinDailySpinsChart daily={data.daily} />
            </SpinChartGrid>
          </>
        )}
      </div>

      <SpinWinCampaignDialog open={creating} onOpenChange={setCreating} />
      <SpinWinCampaignDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} campaign={editing ?? undefined} />
    </>
  );
};

export default AdminSpinWinPage;