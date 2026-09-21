import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList, AnalyticsBarRow } from "./TeacherAnalyticsBarList";
import { TeacherAnalyticsPayments } from "./TeacherAnalyticsPayments";
import type { AnalyticsRange } from "../helpers/teacherAnalyticsTime";
import type { AcademyBreakdown } from "../endpoints/teacher/analytics/academy_GET.schema";
import { useTeacherAnalyticsAcademy } from "../helpers/useTeacherAnalytics";
import { adminFormat } from "../helpers/adminFormat";
import {
  ANALYTICS_RANGE_LABELS,
  CAMPAIGN_LABELS,
  DEVICE_LABELS,
  ENTITY_LABELS,
  PLATFORM_LABELS,
  SOURCE_LABELS,
  bucketLabel,
  labelFor,
  percent,
  shortDate,
} from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsAcademy.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

type LinePoint = { label: string; longLabel: string; views: number; visitors: number };
type TipProps = { active?: boolean; payload?: Array<{ payload: LinePoint }> };

const VisitsTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>{point.longLabel}</span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatchLine} ${styles.slot1}`} />
        Visitors <strong>{adminFormat.count(point.visitors)}</strong>
      </span>
      <span className={styles.tipRow}>
        <span className={`${styles.swatchLine} ${styles.slot2}`} />
        Page views <strong>{adminFormat.count(point.views)}</strong>
      </span>
    </div>
  );
};

/** Visitors per group with who went on to buy or claim, for the ranked lists. */
const visitorRows = (list: AcademyBreakdown[], labels: Record<string, string>): AnalyticsBarRow[] =>
  list
    .filter((item) => item.visitors > 0)
    .map((item) => ({
      key: item.key,
      label: labelFor(labels, item.key),
      meta: [
        `${adminFormat.count(item.views)} ${item.views === 1 ? "view" : "views"}`,
        item.converted > 0 ? `${adminFormat.count(item.converted)} enrolled` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      value: item.visitors,
      display: adminFormat.count(item.visitors),
    }));

export const TeacherAnalyticsAcademy = ({ range, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherAnalyticsAcademy(range, enabled);

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<Eye size={22} />}
        title="Academy figures could not be loaded"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        <Skeleton style={{ height: "7rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const { current, previous, series, bucket, funnel, lifetimeViews, trackingSince } = data;
  const rangeLabel = ANALYTICS_RANGE_LABELS[data.range];
  const profile = data.byEntity.find((item) => item.key === "teacher_profile");
  const hasVisits = current.views > 0 || current.shares > 0;
  const lifetimeTotal = Object.values(lifetimeViews).reduce((total, value) => total + value, 0);
  const startedInRange =
    trackingSince !== null && new Date(trackingSince).getTime() > Date.now() - RANGE_DAYS[data.range] * 86_400_000;

  const points: LinePoint[] = series.map((point) => ({
    label: bucketLabel(point.bucket, bucket),
    longLabel: bucketLabel(point.bucket, bucket, true),
    views: point.views,
    visitors: point.visitors,
  }));

  const funnelSteps = [
    { key: "visitors", label: "Visited your pages", value: funnel.visitors },
    { key: "cart", label: "Added to cart", value: funnel.addedToCart },
    { key: "started", label: "Started a payment", value: funnel.startedPayment },
    { key: "paid", label: "Paid", value: funnel.paid },
  ];

  const change = (now: number, before: number) => {
    const d = adminFormat.delta(now, before);
    return <span className={`${styles.delta} ${styles[d.tone]}`}>{d.text}</span>;
  };

  return (
    <div className={styles.stack}>
      {(trackingSince === null || startedInRange) && (
        <div className={styles.notice} role="note">
          <Info size={16} aria-hidden="true" className={styles.noticeIcon} />
          <p>
            {trackingSince === null
              ? "Visit counting starts once this update is live. Views, visitors and share figures fill in from then on; payments below already cover the whole period."
              : `Visits are counted from ${shortDate(trackingSince)}, so earlier days show none. Payments below cover the whole period.`}
          </p>
        </div>
      )}

      <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Visitors</dt>
            <dd>
              {adminFormat.count(current.visitors)}
              <span className={styles.factNote}>
                {previous.visitors > 0 ? change(current.visitors, previous.visitors) : "people on your pages"}
              </span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Page views</dt>
            <dd>
              {adminFormat.count(current.views)}
              <span className={styles.factNote}>
                {previous.views > 0 ? change(current.views, previous.views) : "profile and item pages"}
              </span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Profile visitors</dt>
            <dd>
              {adminFormat.count(profile?.visitors ?? 0)}
              <span className={styles.factNote}>{adminFormat.count(profile?.views ?? 0)} profile views</span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Added to cart</dt>
            <dd>
              {adminFormat.count(current.carts)}
              <span className={styles.factNote}>
                {current.visitors > 0 ? `${percent((current.carts / current.visitors) * 100)} of visitors` : "visitors"}
              </span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Share button presses</dt>
            <dd>
              {adminFormat.count(current.shares)}
              <span className={styles.factNote}>by you and your students</span>
            </dd>
          </div>
        </dl>

        {!hasVisits ? (
          <ConsoleListEmpty
            icon={<Eye size={22} />}
            title={`No visits recorded in the last ${rangeLabel}`}
            description="Share your profile or a test series on WhatsApp or Telegram. Each visit, where it came from and which share button was used shows up here."
          >
            <Link to="/teacher/test-series" className={styles.link}>
              Share a test series <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </ConsoleListEmpty>
        ) : (
          <>
            <TeacherAnalyticsPanel
              title="Visitors and page views"
              subtitle={`last ${rangeLabel}`}
              legend={[
                { label: "Visitors", slot: 1, shape: "line" },
                { label: "Page views", slot: 2, shape: "line" },
              ]}
              table={{
                caption: `Visitors and page views by ${bucket === "month" ? "month" : "day"}`,
                columns: [bucket === "month" ? "Month" : "Day", "Visitors", "Page views"],
                rows: points.filter((p) => p.views > 0).map((p) => [p.longLabel, p.visitors, p.views]),
              }}
            >
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={points.length <= 12 ? 0 : "preserveStartEnd"}
                      minTickGap={18}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<VisitsTip />} />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="var(--an-series-1)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--an-series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="var(--an-series-2)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--an-series-2)", stroke: "var(--surface)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TeacherAnalyticsPanel>

            <div className={styles.split}>
              <TeacherAnalyticsPanel
                title="Where visitors come from"
                subtitle="visitors"
                table={{
                  caption: "Visitors by source",
                  columns: ["Source", "Visitors", "Page views", "Enrolled"],
                  rows: data.sources.map((item) => [labelFor(SOURCE_LABELS, item.key), item.visitors, item.views, item.converted]),
                }}
              >
                {data.sources.length === 0 ? (
                  <p className={styles.empty}>No visits in this period.</p>
                ) : (
                  <TeacherAnalyticsBarList rows={visitorRows(data.sources, SOURCE_LABELS)} />
                )}
              </TeacherAnalyticsPanel>

              <TeacherAnalyticsPanel
                title="Share buttons used"
                subtitle="presses"
                table={{
                  caption: "Share button presses by platform",
                  columns: ["Platform", "Presses"],
                  rows: data.sharePlatforms.map((item) => [labelFor(PLATFORM_LABELS, item.key), item.shares]),
                }}
              >
                {data.sharePlatforms.length === 0 ? (
                  <p className={styles.empty}>Nobody pressed a share button on your pages in this period.</p>
                ) : (
                  <>
                    <TeacherAnalyticsBarList
                      rows={data.sharePlatforms.map((item) => ({
                        key: item.key,
                        label: labelFor(PLATFORM_LABELS, item.key),
                        value: item.shares,
                        display: adminFormat.count(item.shares),
                      }))}
                    />
                    {data.shareCampaigns.length > 0 && (
                      <p className={styles.footnote}>
                        Pressed{" "}
                        {data.shareCampaigns
                          .map((item) => `${labelFor(CAMPAIGN_LABELS, item.key).replace(/^Shared from /, "on ").toLowerCase()} (${adminFormat.count(item.shares)})`)
                          .join(", ")}
                        .
                      </p>
                    )}
                  </>
                )}
              </TeacherAnalyticsPanel>
            </div>

            <div className={styles.split}>
              <TeacherAnalyticsPanel
                title="Share links that brought visitors"
                subtitle="visitors from tagged links"
                table={{
                  caption: "Visitors by share surface",
                  columns: ["Shared from", "Visitors", "Enrolled"],
                  rows: data.campaigns.map((item) => [labelFor(CAMPAIGN_LABELS, item.key), item.visitors, item.converted]),
                }}
              >
                {data.campaigns.length === 0 ? (
                  <p className={styles.empty}>No visits from share links in this period.</p>
                ) : (
                  <TeacherAnalyticsBarList rows={visitorRows(data.campaigns, CAMPAIGN_LABELS)} />
                )}
              </TeacherAnalyticsPanel>

              <TeacherAnalyticsPanel
                title="Devices"
                subtitle="visitors"
                table={{
                  caption: "Visitors by device",
                  columns: ["Device", "Visitors", "Enrolled"],
                  rows: data.devices.map((item) => [labelFor(DEVICE_LABELS, item.key), item.visitors, item.converted]),
                }}
              >
                <TeacherAnalyticsBarList rows={visitorRows(data.devices, DEVICE_LABELS)} />
              </TeacherAnalyticsPanel>
            </div>

            <div className={styles.split}>
              <TeacherAnalyticsPanel
                title="Pages visited"
                subtitle="visitors"
                table={{
                  caption: "Visitors by page type",
                  columns: ["Page", "Visitors", "Page views", "Added to cart"],
                  rows: data.byEntity.map((item) => [labelFor(ENTITY_LABELS, item.key), item.visitors, item.views, item.carts]),
                }}
              >
                <TeacherAnalyticsBarList rows={visitorRows(data.byEntity, ENTITY_LABELS)} />
              </TeacherAnalyticsPanel>

              <TeacherAnalyticsPanel
                title="From visit to payment"
                subtitle={`last ${rangeLabel}`}
                table={{
                  caption: "From visit to payment",
                  columns: ["Step", "Count"],
                  rows: funnelSteps.map((step) => [step.label, step.value]),
                }}
              >
                <TeacherAnalyticsBarList
                  max={Math.max(1, ...funnelSteps.map((step) => step.value))}
                  rows={funnelSteps.map((step, index) => ({
                    key: step.key,
                    label: step.label,
                    meta:
                      index > 0 && funnelSteps[index - 1].value > 0
                        ? `${percent((step.value / funnelSteps[index - 1].value) * 100)} of the step before`
                        : undefined,
                    value: step.value,
                    display: adminFormat.count(step.value),
                  }))}
                />
                <p className={styles.footnote}>
                  Visitors and carts count browsers; payment steps count students. Signed-in visitors who bought or
                  claimed something from you show as enrolled in the lists above.
                </p>
              </TeacherAnalyticsPanel>
            </div>
          </>
        )}

        {lifetimeTotal > 0 && (
          <TeacherAnalyticsPanel title="Page views before tracking" subtitle="older all-time counters">
            <p className={styles.lifetime}>
              <strong>{adminFormat.count(lifetimeTotal)}</strong> page loads across your items since they went live:{" "}
              {(["mock_test", "live_test", "course", "digital_product"] as const)
                .filter((key) => lifetimeViews[key] > 0)
                .map((key) => `${ENTITY_LABELS[key].toLowerCase()} ${adminFormat.count(lifetimeViews[key])}`)
                .join(", ")}
              . These counters count every page load, repeat visits included, and have no dates or sources.
            </p>
          </TeacherAnalyticsPanel>
        )}
      </div>

      <TeacherAnalyticsPayments range={range} enabled={enabled} />
    </div>
  );
};