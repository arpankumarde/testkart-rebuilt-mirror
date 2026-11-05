import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Switch } from "../components/Switch";
import { Skeleton } from "../components/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { AutopilotLedger } from "../components/AutopilotLedger";
import { toast } from "sonner";
import {
  useAutopilotAiTestMutation,
  useAutopilotOverview,
  useAutopilotSettingsMutation,
  useAutopilotWhatsAppTemplates,
  useCreateAutopilotWhatsAppTemplates,
} from "../helpers/useAdminAutopilot";
import { downloadAdminAutopilotExport } from "../endpoints/admin/autopilot/export_GET.schema";
import type { AutopilotDashboard } from "../helpers/autopilotDashboardData";
import styles from "./admin.autopilot.module.css";

const RANGES = [7, 30, 90] as const;
const TABS = ["overview", "ledger", "playbooks", "channels", "settings"] as const;
type Tab = (typeof TABS)[number];

const inr = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;
const count = (value: number) => Math.round(value).toLocaleString("en-IN");
const ddmmyyyy = (date: Date) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const CHECK_LABELS: Record<string, string> = {
  attribution_coverage: "Paid orders with a known source",
  events_per_hour: "Funnel events arriving",
  checkout_events_match_orders: "Checkout events match orders",
  payment_events_match_orders: "Payment events match orders",
  holdout_leaks: "Messages sent to the holdout",
  sends_without_ledger: "Provider events with no message",
  webhook_freshness: "Delivery receipts arriving",
  payu_captured_but_failed: "Paid at PayU but marked failed (reconcile in Transactions)",
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct or in-app browser",
  search: "Search",
  social: "Social",
  campaign: "Tagged campaign",
  referral: "Other site",
  internal: "Testkart",
  app: "Android or iOS app",
  pay_link: "Payment link",
  unknown: "Unknown (before tracking)",
};

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {note ? <div className={styles.kpiNote}>{note}</div> : null}
    </div>
  );
}

function Funnel({ data }: { data: AutopilotDashboard }) {
  const top = Math.max(1, data.funnel[0]?.count ?? 1);
  return (
    <div className={styles.funnel}>
      {data.funnel.map((step, index) => {
        const previous = index > 0 ? data.funnel[index - 1].count : null;
        const drop = previous && previous > 0 ? Math.round((1 - step.count / previous) * 100) : null;
        const width = Math.max(2, Math.round(Math.sqrt(step.count / top) * 100));
        return (
          <div key={step.key} className={styles.funnelRow}>
            <div className={styles.funnelLabel}>{step.label}</div>
            <div className={styles.funnelTrack}>
              <div className={styles.funnelBar} style={{ width: `${width}%` }} />
            </div>
            <div className={styles.funnelCount}>
              {count(step.count)}
              {drop !== null && drop > 0 ? <span className={styles.drop}>-{drop}%</span> : null}
            </div>
          </div>
        );
      })}
      <p className={styles.footnote}>
        {count(data.signedOutCartClicks)} add-to-cart clicks came from signed-out visitors and met the sign-in wall.
        Bars use a square-root scale so small steps stay visible.
      </p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyBody}>{body}</div>
    </div>
  );
}

const AdminAutopilotPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const overview = useAutopilotOverview(days);
  const settingsMutation = useAutopilotSettingsMutation();
  const aiTest = useAutopilotAiTestMutation();
  const templatesQuery = useAutopilotWhatsAppTemplates();
  const createTemplates = useCreateAutopilotWhatsAppTemplates();
  const [exporting, setExporting] = useState(false);
  const data = overview.data;

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const saveSetting = (patch: { enabled?: boolean; shadow?: boolean; aiProvider?: "deepseek" | "floot" }, done: string) => {
    settingsMutation.mutate(patch, {
      onSuccess: () => toast(done),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadAdminAutopilotExport({ days });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export");
    } finally {
      setExporting(false);
    }
  };

  const aiError = aiTest.error as (Error & { code?: string }) | null;

  const coveragePercent =
    data && data.coverage.paidOrdersSinceTracking > 0
      ? Math.round((data.coverage.withSource / data.coverage.paidOrdersSinceTracking) * 100)
      : null;
  const netProfit = data ? data.kpis.attributedTake - data.kpis.messageCostRupees - data.kpis.offerCostRupees : 0;
  const showRanges = tab !== "ledger" && tab !== "settings";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Revenue autopilot - Testkart Admin</title>
      </Helmet>
      <ConsolePageHeader title="Revenue autopilot" description="Funnel, recovery messages and their measured effect on revenue">
        {showRanges ? (
          <div className={styles.ranges}>
            {RANGES.map((range) => (
              <Button key={range} size="sm" variant={range === days ? "primary" : "outline"} onClick={() => setDays(range)}>
                {range} days
              </Button>
            ))}
          </div>
        ) : null}
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
        <label className={styles.switchLabel}>
          <Switch
            checked={data?.settings.enabled ?? false}
            disabled={!data || settingsMutation.isPending}
            onCheckedChange={(enabled) => saveSetting({ enabled }, enabled ? "Autopilot switched on" : "Autopilot switched off")}
          />
          {data?.settings.enabled ? "On" : "Off"}
        </label>
      </ConsolePageHeader>

      {overview.error ? (
        <div className={styles.errorBox}>{overview.error instanceof Error ? overview.error.message : "Could not load"}</div>
      ) : null}

      {data ? (
        <div className={styles.notice}>
          {data.trackingSince ? `Tracking since ${ddmmyyyy(data.trackingSince)}. ` : "Tracking starts counting once this version is published. "}
          {data.settings.enabled
            ? data.settings.shadow
              ? "The autopilot is on in shadow mode: it logs what it would send and sends nothing."
              : "The autopilot is on and sending real messages. Every message, skip and result is in the Ledger tab."
            : "The autopilot is off: nobody is enrolled and nothing is sent."}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className={styles.tabPanel}>
          <section className={styles.kpis}>
            {!data ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className={styles.kpiSkeleton} />)
            ) : (
              <>
                <Kpi label="Paid orders" value={count(data.kpis.paidOrders)} note={`${inr(data.kpis.gmv)} sales`} />
                <Kpi label="Testkart take" value={inr(data.kpis.take)} note="What Testkart keeps after teacher payouts" />
                <Kpi
                  label="Extra paid orders from playbooks"
                  value={data.incremental?.enoughData ? `${data.incremental.conversions}` : "Not proven yet"}
                  note={
                    data.incremental?.enoughData
                      ? `90% range ${data.incremental.low} to ${data.incremental.high}, against the holdout`
                      : "Needs at least 30 people in each playbook's holdout"
                  }
                />
                <Kpi
                  label="Attributed to messages"
                  value={inr(data.kpis.attributedGmv)}
                  note={`${count(data.kpis.attributedOrders)} orders, an upper bound and not impact`}
                />
                <Kpi
                  label="Cost"
                  value={inr(data.kpis.messageCostRupees + data.kpis.offerCostRupees)}
                  note={`Net on attributed orders ${inr(netProfit)}`}
                />
                <Kpi
                  label="Orders with a known source"
                  value={coveragePercent === null ? "No orders yet" : `${coveragePercent}%`}
                  note={`${count(data.coverage.withSource)} of ${count(data.coverage.paidOrdersSinceTracking)} since tracking began; target 95%`}
                />
              </>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Funnel</h2>
            {data ? <Funnel data={data} /> : <Skeleton className={styles.blockSkeleton} />}
          </section>

          <div className={styles.twoCol}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Where paid orders came from</h2>
              {!data ? (
                <Skeleton className={styles.blockSkeleton} />
              ) : data.sources.length === 0 ? (
                <Empty title="No paid orders in this period" body="Sources appear as orders come in." />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th className={styles.num}>Orders</th>
                      <th className={styles.num}>Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((row) => (
                      <tr key={row.source}>
                        <td>{SOURCE_LABELS[row.source] ?? row.source.replace(/_/g, " ")}</td>
                        <td className={styles.num}>{count(row.orders)}</td>
                        <td className={styles.num}>{inr(row.gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Data quality</h2>
              {!data ? (
                <Skeleton className={styles.blockSkeleton} />
              ) : data.checks.length === 0 ? (
                <Empty title="No checks have run yet" body="The daily data check starts after the next publish." />
              ) : (
                <ul className={styles.checks}>
                  {data.checks.map((check) => (
                    <li key={check.key} className={styles.checkRow}>
                      <span>{CHECK_LABELS[check.key] ?? check.key.replace(/_/g, " ")}</span>
                      <Badge variant={check.status === "pass" ? "success" : check.status === "warn" ? "warning" : "destructive"}>
                        {check.value === null ? check.status : `${check.value}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="ledger" className={styles.tabPanel}>
          <p className={styles.aiText}>
            Every message the autopilot created and what happened to it, and everyone currently in a playbook with their
            next message time. Updates every 15 minutes, when the autopilot runs.
          </p>
          <AutopilotLedger />
        </TabsContent>

        <TabsContent value="playbooks" className={styles.tabPanel}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Playbooks</h2>
            {!data ? (
              <Skeleton className={styles.blockSkeleton} />
            ) : (data.playbooks ?? []).every((row) => row.enrolled === 0) ? (
              <Empty
                title="Nobody enrolled yet"
                body="With the autopilot on, people enter a playbook within 15 minutes of a failed payment, an abandoned cart, a signup, a free test or a purchase. Each row then shows its reach and its lift against the holdout."
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Playbook</th>
                    <th className={styles.num}>Enrolled</th>
                    <th className={styles.num}>Sent</th>
                    <th className={styles.num}>Shadow</th>
                    <th className={styles.num}>Clicked</th>
                    <th className={styles.num}>Goal reached</th>
                    <th className={styles.num}>Lift (90% range)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.playbooks.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td className={styles.num}>
                        {count(row.enrolled)} <span className={styles.drop}>({count(row.holdout)} held out)</span>
                      </td>
                      <td className={styles.num}>{count(row.messages)}</td>
                      <td className={styles.num}>{count(row.shadowMessages)}</td>
                      <td className={styles.num}>{count(row.clicked)}</td>
                      <td className={styles.num}>
                        {Math.round(row.treatedRate * 100)}% vs {Math.round(row.holdoutRate * 100)}%
                      </td>
                      <td className={styles.num}>
                        {row.enoughData
                          ? `${Math.round(row.lift * 1000) / 10} pts (${Math.round(row.liftLow * 1000) / 10} to ${Math.round(row.liftHigh * 1000) / 10})`
                          : "Not enough data"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.footnote}>
              Goal reached means a paid order within 7 days (onboarding: a first test). Lift compares people who got
              messages with the holdout, who got none.
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Checkout helpers</h2>
            <p className={styles.aiText}>
              Payment links let a parent or friend pay for a student's cart. The kept cart saves what a signed-out visitor
              picked and puts it in their cart after they sign in.
            </p>
            {!data ? (
              <Skeleton className={styles.blockSkeleton} />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Helper</th>
                    <th className={styles.num}>Used</th>
                    <th className={styles.num}>Next step</th>
                    <th className={styles.num}>Paid</th>
                    <th className={styles.num}>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Payment links</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.payLinksCreated ?? 0)} made</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.payLinksOpened ?? 0)} opened</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.payLinksPaid ?? 0)}</td>
                    <td className={styles.num}>{inr(data.checkoutHelpers?.payLinkGmv ?? 0)}</td>
                  </tr>
                  <tr>
                    <td>Cart kept across sign-in</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.guestCartMerges ?? 0)} sign-ins</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.guestCartItems ?? 0)} items added</td>
                    <td className={styles.num}>{count(data.checkoutHelpers?.guestCartPaidUsers ?? 0)} within 7 days</td>
                    <td className={styles.num}>-</td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Teacher own-link sales (shadow)</h2>
            <p className={styles.aiText}>
              Sales that came through a teacher's own share link. This only measures the "12% fee on sales you bring"
              idea; no teacher's fee changes. The planned rule applies 12% only above each teacher's usual monthly sales.
            </p>
            {!data ? (
              <Skeleton className={styles.blockSkeleton} />
            ) : (data.teacherOwnLinks ?? []).length === 0 ? (
              <Empty title="No own-link sales yet" body="They appear once students buy through a link a teacher shared from their console or profile." />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th className={styles.num}>Own-link orders</th>
                    <th className={styles.num}>Own-link sales</th>
                    <th className={styles.num}>Share of their sales</th>
                    <th className={styles.num}>Fee now vs at 12%</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.teacherOwnLinks ?? []).map((row) => (
                    <tr key={row.teacherName}>
                      <td>{row.teacherName}</td>
                      <td className={styles.num}>{count(row.ownOrders)}</td>
                      <td className={styles.num}>{inr(row.ownGmv)}</td>
                      <td className={styles.num}>{row.totalGmv > 0 ? `${Math.round((row.ownGmv / row.totalGmv) * 100)}%` : "-"}</td>
                      <td className={styles.num}>
                        {inr(row.feeNow)} vs {inr(row.feeAtTwelve)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="channels" className={styles.tabPanel}>
          <div className={styles.twoCol}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Channels</h2>
              {!data ? (
                <Skeleton className={styles.blockSkeleton} />
              ) : data.channels.length === 0 ? (
                <Empty title="Nothing sent yet" body="Email, WhatsApp and push sends, opens, clicks and cost show here." />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th className={styles.num}>Sent</th>
                      <th className={styles.num}>Delivered</th>
                      <th className={styles.num}>Opened</th>
                      <th className={styles.num}>Clicked</th>
                      <th className={styles.num}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((row) => (
                      <tr key={row.channel}>
                        <td>{row.channel}</td>
                        <td className={styles.num}>{count(row.sent)}</td>
                        <td className={styles.num}>{count(row.delivered)}</td>
                        <td className={styles.num}>{count(row.opened)}</td>
                        <td className={styles.num}>{count(row.clicked)}</td>
                        <td className={styles.num}>{inr(row.costRupees)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.aiHeader}>
                <div>
                  <h2 className={styles.cardTitle}>WhatsApp templates</h2>
                  <p className={styles.aiText}>
                    Meta must approve each template before the autopilot can use it. WhatsApp goes to anyone with a mobile
                    number unless they said no or replied STOP: for a playbook's first message, and for later messages when
                    the person has no usable email.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={createTemplates.isPending}
                  onClick={() =>
                    createTemplates.mutate(undefined, {
                      onSuccess: () => toast("Templates checked; any missing ones were sent to Meta"),
                      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create templates"),
                    })
                  }
                >
                  {createTemplates.isPending ? "Submitting..." : "Create missing templates"}
                </Button>
              </div>
              {templatesQuery.isFetching && !templatesQuery.data ? (
                <Skeleton className={styles.blockSkeleton} />
              ) : templatesQuery.error ? (
                <div className={styles.errorBox}>
                  {templatesQuery.error instanceof Error ? templatesQuery.error.message : "Could not load templates"}
                </div>
              ) : (
                <ul className={styles.checks}>
                  {(templatesQuery.data?.templates ?? []).map((template) => (
                    <li key={template.name} className={styles.checkRow}>
                      <span>
                        {template.name} <span className={styles.drop}>({template.playbookKey.replace(/_/g, " ")})</span>
                      </span>
                      <Badge
                        variant={template.status === "APPROVED" ? "success" : template.status === "PENDING" ? "warning" : "destructive"}
                      >
                        {template.status.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Latest replies</h2>
            <p className={styles.aiText}>
              WhatsApp replies and messages people send back. A reply of STOP turns off WhatsApp offers for that person.
            </p>
            {!data ? (
              <Skeleton className={styles.blockSkeleton} />
            ) : (data.replies ?? []).length === 0 ? (
              <Empty title="No replies yet" body="Replies appear here when people write back on WhatsApp." />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>From</th>
                    <th>Message</th>
                    <th>Playbook</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.replies ?? []).map((reply) => (
                    <tr key={reply.id}>
                      <td>{ddmmyyyy(reply.receivedAt)}</td>
                      <td>{reply.userName ?? "Unknown number"}</td>
                      <td>{reply.body.length > 140 ? `${reply.body.slice(0, 137)}...` : reply.body}</td>
                      <td>{reply.playbook ? reply.playbook.replace(/_/g, " ") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="settings" className={styles.tabPanel}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Sending</h2>
            {data ? (
              <div className={styles.aiRows}>
                <div className={styles.aiRow}>
                  <div>
                    <div>Autopilot</div>
                    <div className={styles.aiHint}>Off stops new enrolments and all messages.</div>
                  </div>
                  <label className={styles.switchLabel}>
                    <Switch
                      checked={data.settings.enabled}
                      disabled={settingsMutation.isPending}
                      onCheckedChange={(enabled) => saveSetting({ enabled }, enabled ? "Autopilot switched on" : "Autopilot switched off")}
                    />
                    {data.settings.enabled ? "On" : "Off"}
                  </label>
                </div>
                <div className={styles.aiRow}>
                  <div>
                    <div>Shadow mode</div>
                    <div className={styles.aiHint}>On: it logs what it would send and sends nothing. Off: real email and WhatsApp messages.</div>
                  </div>
                  <label className={styles.switchLabel}>
                    <Switch
                      checked={data.settings.shadow}
                      disabled={settingsMutation.isPending}
                      onCheckedChange={(shadow) =>
                        saveSetting({ shadow }, shadow ? "Shadow mode on: nothing will be sent" : "Shadow mode off: real messages will be sent")
                      }
                    />
                    {data.settings.shadow ? "On" : "Off"}
                  </label>
                </div>
                <div className={styles.aiRow}>
                  <span>Holdout</span>
                  <span>{data.settings.holdoutPercent}% of people get no messages, to measure lift</span>
                </div>
              </div>
            ) : (
              <Skeleton className={styles.blockSkeleton} />
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.aiHeader}>
              <div>
                <h2 className={styles.cardTitle}>AI for the autopilot</h2>
                <p className={styles.aiText}>
                  Used only for the autopilot's message drafts and for matching typed exam names to the catalogue. Teacher
                  and admin AI tools always use our DeepSeek model.
                </p>
              </div>
              <label className={styles.switchLabel}>
                <Switch
                  checked={data?.settings.aiProvider === "floot"}
                  disabled={!data || settingsMutation.isPending}
                  onCheckedChange={(useFloot) => {
                    aiTest.reset();
                    saveSetting(
                      { aiProvider: useFloot ? "floot" : "deepseek" },
                      useFloot ? "Autopilot AI now uses Floot AI" : "Autopilot AI now uses our DeepSeek model"
                    );
                  }}
                />
                Use Floot AI
              </label>
            </div>
            {data ? (
              <div className={styles.aiRows}>
                <div className={styles.aiRow}>
                  <span>In use</span>
                  <Badge variant={data.settings.aiProvider === "floot" ? "warning" : "success"}>
                    {data.settings.aiProvider === "floot" ? "Floot AI (gpt-6-luna)" : "Our model (DeepSeek chat)"}
                  </Badge>
                </div>
                <div className={styles.aiRow}>
                  <span>Billing</span>
                  <span>
                    {data.settings.aiProvider === "floot"
                      ? "Floot credits, on Floot's bill"
                      : data.settings.deepseekConfigured
                        ? "Our DeepSeek account"
                        : "DeepSeek key missing"}
                  </span>
                </div>
              </div>
            ) : (
              <Skeleton className={styles.blockSkeleton} />
            )}
            <div className={styles.aiActions}>
              <Button size="sm" variant="outline" onClick={() => aiTest.mutate()} disabled={!data || aiTest.isPending}>
                {aiTest.isPending ? "Drafting..." : "Try a sample draft"}
              </Button>
              <span className={styles.aiHint}>Drafts one failed-payment reminder. Nothing is sent or saved.</span>
            </div>
            {aiTest.data ? (
              <div className={styles.aiResult}>
                <div className={styles.aiDraft}>{aiTest.data.text || "The model returned no text."}</div>
                <div className={styles.aiMeta}>
                  {aiTest.data.provider === "floot" ? "Floot AI" : "DeepSeek"} - {aiTest.data.model} -{" "}
                  {(aiTest.data.ms / 1000).toFixed(1)}s
                  {aiTest.data.flootCredits !== null ? ` - ${aiTest.data.flootCredits} credits` : ""}
                </div>
              </div>
            ) : null}
            {aiError ? (
              <div className={styles.errorBox}>
                {aiError.code === "OUT_OF_CREDITS"
                  ? "Floot AI credits are used up. Switch back to our model or top up credits in Floot."
                  : aiError.code === "DISALLOWED"
                    ? "Floot AI is switched off for this project in Floot's settings. Switch back to our model."
                    : aiError.message}
              </div>
            ) : null}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAutopilotPage;
