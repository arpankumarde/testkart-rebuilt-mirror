import React from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { useAutopilotOperations } from "../helpers/useAdminAutopilot";
import type { AutopilotOperations as Ops, OperationsHour, OperationsRun, OperationsStep } from "../helpers/autopilotOperationsData";
import styles from "./AutopilotOperations.module.css";

const IST_MS = 330 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const ist = (value: Date) => new Date(new Date(value).getTime() + IST_MS);
const istHour = (value: Date) => ist(value).getUTCHours();
const istDay = (value: Date) => {
  const d = ist(value);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}`;
};
const istTime = (value: Date) => {
  const d = ist(value);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const count = (value: number) => Math.round(value).toLocaleString("en-IN");
const inr = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const ago = (value: Date, now: Date) => {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min ago`;
};

const SERIES = [
  { key: "whatsappDelivered", label: "WhatsApp delivered", color: "var(--success)" },
  { key: "emailDelivered", label: "Email delivered", color: "var(--info)" },
  { key: "awaitingReceipt", label: "Sent, no receipt yet", color: "var(--chart-color-5)" },
  { key: "failed", label: "Failed", color: "var(--error)" },
  { key: "skipped", label: "Skipped", color: "var(--warning)" },
  { key: "scheduled", label: "Scheduled", color: "var(--muted-foreground)" },
] as const;

const RUN_SERIES = [
  { key: "sent", label: "Sent", color: "var(--success)" },
  { key: "failed", label: "Failed", color: "var(--error)" },
  { key: "skipped", label: "No channel", color: "var(--warning)" },
  { key: "deferred", label: "Held for quiet hours or caps", color: "var(--muted-foreground)" },
] as const;

function Legend({ items }: { items: readonly { key: string; label: string; color: string }[] }) {
  return (
    <div className={styles.legend}>
      {items.map((item) => (
        <span key={item.key} className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Meter({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "error" | "warning" | "success" }) {
  const width = max > 0 ? Math.min(100, Math.max(value > 0 ? 3 : 0, (value / max) * 100)) : 0;
  return (
    <div className={styles.meter} role="presentation">
      <div className={`${styles.meterFill} ${styles[`tone_${tone}`]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function engineHealth(data: Ops): { tone: "success" | "warning" | "destructive"; label: string; detail: string } {
  if (!data.enabled) return { tone: "destructive", label: "Off", detail: "Nothing is enrolled or sent" };
  if (!data.lastRun) return { tone: "warning", label: "Waiting", detail: "Runs are logged from the next publish" };
  const minutes = (new Date(data.generatedAt).getTime() - new Date(data.lastRun.startedAt).getTime()) / 60000;
  if (minutes > 35) return { tone: "destructive", label: "Late", detail: `Last run ${ago(data.lastRun.startedAt, data.generatedAt)}` };
  if (data.lastRun.errors > 0) return { tone: "warning", label: "Errors", detail: `${data.lastRun.errors} in the last run` };
  return { tone: "success", label: data.shadow ? "Shadow" : "Running", detail: `Last run ${ago(data.lastRun.startedAt, data.generatedAt)}` };
}

function StatusStrip({ data }: { data: Ops }) {
  const health = engineHealth(data);
  const { today, queue } = data;
  const attempts = today.sent + today.failed;
  return (
    <section className={styles.strip}>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>Engine</span>
          <Badge variant={health.tone}>{health.label}</Badge>
        </div>
        <div className={styles.tileValue}>{data.lastRun ? istTime(data.lastRun.startedAt) : "-"}</div>
        <div className={styles.tileNote}>{health.detail}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>Sent today</span>
          <span className={styles.tileNote}>{today.failed} failed</span>
        </div>
        <div className={styles.tileValue}>{count(today.sent)}</div>
        <Meter value={today.failed} max={attempts} tone="error" />
        <div className={styles.tileNote}>{pct(today.failed, attempts)}% of attempts failed</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>Tcoin offers today</span>
          <span className={styles.tileNote}>of {inr(today.offerBudgetRupees)}</span>
        </div>
        <div className={styles.tileValue}>{inr(today.offerRupees)}</div>
        <Meter value={today.offerRupees} max={today.offerBudgetRupees} tone={today.offerRupees >= today.offerBudgetRupees ? "warning" : "primary"} />
        <div className={styles.tileNote}>
          {today.offerRupees >= today.offerBudgetRupees ? "Budget used up: offer steps send without Tcoins" : "Daily budget for offer steps"}
        </div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>Queue</span>
          <span className={styles.tileNote}>{count(queue.activePeople)} people active</span>
        </div>
        <div className={styles.tileValue}>{count(queue.nextHour)}</div>
        <Meter value={queue.nextHour} max={Math.max(queue.next24Hours, 1)} />
        <div className={styles.tileNote}>due in the next hour, {count(queue.next24Hours)} in 24 hours</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <span className={styles.tileLabel}>Orders from messages today</span>
        </div>
        <div className={styles.tileValue}>{count(today.ordersFromMessages)}</div>
        <div className={styles.tileNote}>{inr(today.orderAmount)} in sales, credited to a clicked message</div>
      </div>
    </section>
  );
}

type HourPoint = OperationsHour & { label: string; key: number };

function HourTip({ active, payload }: { active?: boolean; payload?: { payload: HourPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rows = SERIES.filter((s) => (point[s.key] as number) > 0);
  return (
    <div className={styles.tip}>
      <div className={styles.tipHead}>
        {istDay(point.hour)} {pad(istHour(point.hour))}:00 IST{point.future ? ", planned" : ""}
      </div>
      {rows.length === 0 ? <div className={styles.tipRow}>Nothing</div> : null}
      {rows.map((s) => (
        <div key={s.key} className={styles.tipRow}>
          <span className={styles.swatch} style={{ background: s.color }} />
          <span>{s.label}</span>
          <strong>{point[s.key] as number}</strong>
        </div>
      ))}
    </div>
  );
}

function HourlyChart({ data }: { data: Ops }) {
  const points: HourPoint[] = data.hours.map((h) => ({ ...h, key: new Date(h.hour).getTime(), label: String(new Date(h.hour).getTime()) }));
  const nowPoint = [...points].reverse().find((p) => !p.future);
  const quiet: { x1: string; x2: string }[] = [];
  let start: string | null = null;
  let previous: string | null = null;
  for (const p of points) {
    const hour = istHour(p.hour);
    const isQuiet = hour < data.sendWindow.start || hour >= data.sendWindow.end;
    if (isQuiet && start === null) start = p.label;
    if (!isQuiet && start !== null && previous) {
      quiet.push({ x1: start, x2: previous });
      start = null;
    }
    previous = p.label;
  }
  if (start !== null && previous) quiet.push({ x1: start, x2: previous });
  const tick = (value: string) => {
    const d = new Date(Number(value));
    const hour = istHour(d);
    return hour === 0 ? istDay(d) : hour % 6 === 0 ? `${pad(hour)}:00` : "";
  };
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Messages by hour</h2>
          <p className={styles.cardSub}>Last 48 hours and the next 24 (IST). Shaded hours are quiet hours, when nothing is sent.</p>
        </div>
        <Legend items={SERIES} />
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            {quiet.map((q) => (
              <ReferenceArea key={q.x1} x1={q.x1} x2={q.x2} fill="var(--muted)" fillOpacity={1} strokeOpacity={0} ifOverflow="visible" />
            ))}
            <XAxis dataKey="label" tickFormatter={tick} interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip cursor={{ fill: "var(--accent)" }} content={<HourTip />} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="m" fill={s.color} maxBarSize={18} isAnimationActive={false} />
            ))}
            {nowPoint ? (
              <ReferenceLine x={nowPoint.label} stroke="var(--foreground)" strokeDasharray="4 3" label={{ value: "Now", position: "insideTopRight", fill: "var(--foreground)", fontSize: 11 }} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type RunPoint = OperationsRun & { label: string };

function RunTip({ active, payload }: { active?: boolean; payload?: { payload: RunPoint }[] }) {
  if (!active || !payload?.length) return null;
  const run = payload[0].payload;
  return (
    <div className={styles.tip}>
      <div className={styles.tipHead}>
        Run at {istTime(run.startedAt)} IST, {(run.durationMs / 1000).toFixed(1)} s
      </div>
      <div className={styles.tipRow}>Due {run.due}, sent {run.sent}, failed {run.failed}</div>
      <div className={styles.tipRow}>No channel {run.skipped}, held {run.deferred}</div>
      <div className={styles.tipRow}>Goal reached {run.converted}, rescued by email {run.rescued}</div>
      {run.errors > 0 ? <div className={styles.tipError}>{run.errors} error{run.errors > 1 ? "s" : ""}{run.error ? `: ${run.error}` : ""}</div> : null}
    </div>
  );
}

function RunsChart({ data }: { data: Ops }) {
  const points: RunPoint[] = data.runs.map((r) => ({ ...r, label: istTime(r.startedAt) }));
  const errorRuns = points.filter((r) => r.errors > 0);
  const slow = points.reduce((max, r) => Math.max(max, r.durationMs), 0);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Engine runs, last 24 hours</h2>
          <p className={styles.cardSub}>
            One bar per 15-minute run. {points.length} runs
            {points.length ? `, slowest ${(slow / 1000).toFixed(1)} s` : ""}
            {errorRuns.length ? `, ${errorRuns.length} with errors (marked below the bar)` : ", none with errors"}.
          </p>
        </div>
        <Legend items={RUN_SERIES} />
      </div>
      {points.length === 0 ? (
        <div className={styles.empty}>The run log starts with the first run after this version is published.</div>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip cursor={{ fill: "var(--accent)" }} content={<RunTip />} />
              {RUN_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="r" fill={s.color} maxBarSize={14} isAnimationActive={false} />
              ))}
              {errorRuns.map((r) => (
                <ReferenceLine key={r.label} x={r.label} stroke="var(--error)" strokeWidth={2} segment={undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

const FUNNEL = [
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "read", label: "Read or opened" },
  { key: "clicked", label: "Clicked" },
  { key: "ordered", label: "Paid in 72 h" },
] as const;

const delayLabel = (hours: number) => (hours < 1 ? `${Math.round(hours * 60)} min` : hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`);

function StepCard({ step }: { step: OperationsStep }) {
  const total = Math.max(step.sent, 1);
  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepName}>Message {step.step}</span>
        {step.offer ? <Badge variant="warning">Tcoin offer</Badge> : null}
      </div>
      <div className={styles.stepMeta}>
        {step.step === 1 ? "First message" : "Next message"} {delayLabel(step.delayHours)} after the trigger
      </div>
      <div className={styles.waiting}>
        <strong>{count(step.waiting)}</strong> waiting for this message
      </div>
      {step.sent === 0 ? (
        <div className={styles.stepEmpty}>Nothing sent in 7 days</div>
      ) : (
        <>
          <div className={styles.split} aria-label={`${step.whatsapp} WhatsApp, ${step.email} email`}>
            <div className={styles.splitWhatsapp} style={{ flexGrow: step.whatsapp }} />
            <div className={styles.splitEmail} style={{ flexGrow: step.email }} />
          </div>
          <div className={styles.splitLabels}>
            <span>WhatsApp {step.whatsapp}</span>
            <span>Email {step.email}</span>
          </div>
          <div className={styles.funnelRows}>
            {FUNNEL.map((f) => {
              const value = step[f.key];
              return (
                <div key={f.key} className={styles.funnelRow}>
                  <span className={styles.funnelLabel}>{f.label}</span>
                  <Meter value={value} max={total} tone={f.key === "ordered" ? "success" : "primary"} />
                  <span className={styles.funnelValue}>
                    {value}
                    {f.key !== "sent" ? <span className={styles.funnelPct}>{pct(value, step.sent)}%</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StepJourneys({ data }: { data: Ops }) {
  const playbooks = [...new Set(data.steps.map((s) => s.playbook))];
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Each playbook, message by message</h2>
      <p className={styles.cardSub}>Real messages of the last 7 days. Waiting counts are live: people whose next message is that one.</p>
      <div className={styles.playbooks}>
        {playbooks.map((key) => {
          const steps = data.steps.filter((s) => s.playbook === key);
          return (
            <div key={key} className={styles.playbook}>
              <div className={styles.playbookName}>{steps[0]?.label ?? key}</div>
              <div className={styles.steps}>
                {steps.map((step) => (
                  <StepCard key={step.step} step={step} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Reasons({ data }: { data: Ops }) {
  const top = Math.max(1, ...data.reasons.map((r) => r.count));
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Why messages did not reach people</h2>
      <p className={styles.cardSub}>Last 7 days, real messages, and what the autopilot now does about each.</p>
      {data.reasons.length === 0 ? (
        <div className={styles.empty}>Every message went out in the last 7 days.</div>
      ) : (
        <div className={styles.reasons}>
          {data.reasons.map((r) => (
            <div key={r.key} className={styles.reason}>
              <div className={styles.reasonText}>
                <span className={styles.reasonLabel}>{r.label}</span>
                <span className={styles.reasonAction}>{r.action}</span>
              </div>
              <Meter value={r.count} max={top} tone={r.tone === "rescued" ? "success" : r.tone === "skipped" ? "warning" : "error"} />
              <span className={styles.reasonCount}>{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Channels({ data }: { data: Ops }) {
  const rows = data.channels.filter((c) => c.sent > 0);
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Email and WhatsApp side by side</h2>
      <p className={styles.cardSub}>Last 7 days. Rates are shares of messages sent on that channel.</p>
      {rows.length === 0 ? (
        <div className={styles.empty}>Nothing sent in the last 7 days.</div>
      ) : (
        <div className={styles.channelGrid}>
          {rows.map((c) => {
            const opensMissing = c.channel === "email" && c.read === 0 && c.delivered >= 20;
            const metrics = [
              { label: "Delivered", value: c.delivered, note: null as string | null },
              { label: c.channel === "whatsapp" ? "Read" : "Opened", value: c.read, note: opensMissing ? "Not reported by the email provider" : null },
              { label: "Clicked", value: c.clicked, note: null },
              { label: "Paid in 72 h", value: c.ordered, note: null },
            ];
            return (
              <div key={c.channel} className={styles.channel}>
                <div className={styles.channelHead}>
                  <span className={styles.channelName}>{c.channel === "whatsapp" ? "WhatsApp" : c.channel === "email" ? "Email" : c.channel}</span>
                  <span className={styles.tileNote}>
                    {count(c.sent)} sent, {inr(c.costRupees)}
                    {c.clicked > 0 ? `, Rs ${(c.costRupees / c.clicked).toFixed(1)} a click` : ""}
                  </span>
                </div>
                {metrics.map((m) => (
                  <div key={m.label} className={styles.funnelRow}>
                    <span className={styles.funnelLabel}>{m.label}</span>
                    {m.note ? <span className={styles.metricNote}>{m.note}</span> : <Meter value={m.value} max={c.sent} tone={m.label === "Paid in 72 h" ? "success" : "primary"} />}
                    <span className={styles.funnelValue}>
                      {m.note ? "-" : `${pct(m.value, c.sent)}%`}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The Autopilot page's Operations tab: engine health, hourly sends and queue, step funnels and failure reasons. */
export function AutopilotOperations({ active }: { active: boolean }) {
  const query = useAutopilotOperations(active);
  const data = query.data;
  if (query.error) {
    return <div className={styles.error}>{query.error instanceof Error ? query.error.message : "Could not load the operations"}</div>;
  }
  if (!data) {
    return (
      <div className={styles.wrap}>
        <Skeleton className={styles.stripSkeleton} />
        <Skeleton className={styles.chartSkeleton} />
        <Skeleton className={styles.chartSkeleton} />
      </div>
    );
  }
  return (
    <div className={styles.wrap}>
      <StatusStrip data={data} />
      <HourlyChart data={data} />
      <div className={styles.twoCol}>
        <Reasons data={data} />
        <Channels data={data} />
      </div>
      <StepJourneys data={data} />
      <RunsChart data={data} />
      <p className={styles.updated}>
        Updated {istTime(data.generatedAt)} IST. Reopen the tab or switch back to this window to refresh.
      </p>
    </div>
  );
}