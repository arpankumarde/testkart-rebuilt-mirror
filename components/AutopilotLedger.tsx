import React, { useEffect, useState } from "react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { AutopilotJourney } from "./AutopilotJourney";
import { useAutopilotLedger } from "../helpers/useAdminAutopilot";
import type { LedgerMessage, LedgerPerson, OutputType } from "../endpoints/admin/autopilot/ledger_GET.schema";
import styles from "./AutopilotLedger.module.css";

type View = "messages" | "people";
type Outcome = "all" | "sent" | "skipped" | "failed" | "clicked" | "ordered" | "shadow";
type State = "active" | "finished" | "held_out";

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "all", label: "All real messages" },
  { value: "sent", label: "Sent" },
  { value: "skipped", label: "Skipped" },
  { value: "failed", label: "Failed or bounced" },
  { value: "clicked", label: "Clicked" },
  { value: "ordered", label: "Led to an order" },
  { value: "shadow", label: "Shadow (logged only)" },
];

const STATES: { value: State; label: string }[] = [
  { value: "active", label: "Waiting for next message" },
  { value: "finished", label: "Finished" },
  { value: "held_out", label: "Held out (get nothing)" },
];

const REASONS: Record<string, string> = {
  "no reachable channel": "No usable email or WhatsApp number",
  shadow: "Shadow mode, logged only",
};

const CHANNEL_LABEL: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", push: "App push", onsite: "On site" };

const pad = (n: number) => String(n).padStart(2, "0");
const when = (value: Date | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inr = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;
const reasonLabel = (reason: string | null) => (reason ? REASONS[reason] ?? reason.charAt(0).toUpperCase() + reason.slice(1) : null);

function MessageResult({ row }: { row: LedgerMessage }) {
  if (row.orderId) return <Badge variant="success">Ordered #{row.orderId}</Badge>;
  if (row.shadow) return <Badge variant="secondary">Shadow</Badge>;
  if (row.status === "skipped") return <Badge variant="warning">Skipped</Badge>;
  if (["failed", "bounced", "complained"].includes(row.status)) return <Badge variant="destructive">{row.status}</Badge>;
  if (row.clickedAt) return <Badge variant="success">Clicked{row.clicks > 1 ? ` x${row.clicks}` : ""}</Badge>;
  if (row.openedAt) return <Badge variant="default">Opened</Badge>;
  if (row.deliveredAt) return <Badge variant="default">Delivered</Badge>;
  if (row.sentAt) return <Badge variant="default">Sent</Badge>;
  return <Badge variant="secondary">{row.status}</Badge>;
}

function PersonStatus({ row }: { row: LedgerPerson }) {
  if (row.heldOut) return <span className={styles.muted}>Held out: gets no messages, used to measure lift</span>;
  if (row.convertedOrderId) return <Badge variant="success">Converted, order #{row.convertedOrderId}</Badge>;
  if (row.state === "active") {
    return row.nextDueAt ? (
      <span>
        Message {row.nextStep ?? "-"} due {when(row.nextDueAt)}
      </span>
    ) : (
      <span className={styles.muted}>No more messages planned</span>
    );
  }
  return <span className={styles.muted}>{row.exitReason ? reasonLabel(row.exitReason) : "Finished"}</span>;
}

function Summary({ data }: { data: OutputType }) {
  const s = data.summary;
  const tiles = [
    { label: "Sent", value: s.sent.toLocaleString("en-IN") },
    { label: "Delivered", value: s.delivered.toLocaleString("en-IN") },
    { label: "Opened", value: s.opened.toLocaleString("en-IN") },
    { label: "Clicked", value: s.clicked.toLocaleString("en-IN") },
    { label: "Orders from messages", value: `${s.orders} (${inr(s.orderAmount)})` },
    { label: "Cost", value: `${inr(s.costRupees)}${s.offerCoins > 0 ? ` + ${s.offerCoins} Tcoins` : ""}` },
    { label: "Due in the next hour", value: s.dueNextHour.toLocaleString("en-IN") },
    { label: "Due in the next 24 hours", value: s.dueToday.toLocaleString("en-IN") },
  ];
  return (
    <div className={styles.summary}>
      <div className={styles.summaryHead}>Last 24 hours</div>
      <div className={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.tile}>
            <div className={styles.tileLabel}>{t.label}</div>
            <div className={styles.tileValue}>{t.value}</div>
          </div>
        ))}
      </div>
      {s.failed > 0 || s.skipped.length > 0 ? (
        <ul className={styles.reasons}>
          {s.failed > 0 ? <li>{s.failed} failed or bounced</li> : null}
          {s.skipped.map((r) => (
            <li key={r.reason}>
              {r.count} skipped: {reasonLabel(r.reason)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Student({ id, name, onOpen }: { id: number; name: string | null; onOpen: (id: number) => void }) {
  return (
    <button type="button" className={styles.studentLink} onClick={() => onOpen(id)} title="Open this student's journey">
      {name ?? "Student"} <span className={styles.muted}>#{id}</span>
    </button>
  );
}

/** The Autopilot page's ledger: every message and every person in a playbook, with filters; a student opens their journey. */
export function AutopilotLedger() {
  const [view, setView] = useState<View>("messages");
  const [playbook, setPlaybook] = useState("all");
  const [channel, setChannel] = useState("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [state, setState] = useState<State>("active");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [journeyUser, setJourneyUser] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [view, playbook, channel, outcome, state, q]);

  const ledger = useAutopilotLedger(
    {
      view,
      playbook: playbook === "all" ? undefined : playbook,
      channel: view === "messages" && channel !== "all" ? (channel as "email" | "whatsapp" | "push") : undefined,
      outcome: view === "messages" ? outcome : undefined,
      state: view === "people" ? state : undefined,
      q: q || undefined,
      page,
    },
    true
  );
  const data = ledger.data;
  const playbookLabel = (key: string) => data?.playbooks.find((p) => p.key === key)?.label ?? key.replace(/_/g, " ");
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.wrap}>
      {data ? <Summary data={data} /> : <Skeleton className={styles.summarySkeleton} />}

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Ledger view">
          <Button size="sm" variant={view === "messages" ? "primary" : "outline"} onClick={() => setView("messages")}>
            Messages
          </Button>
          <Button size="sm" variant={view === "people" ? "primary" : "outline"} onClick={() => setView("people")}>
            People in playbooks
          </Button>
        </div>

        <div className={styles.filters}>
          <Select value={playbook} onValueChange={setPlaybook}>
            <SelectTrigger className={styles.select} aria-label="Playbook">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All playbooks</SelectItem>
              {(data?.playbooks ?? []).map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {view === "messages" ? (
            <>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className={styles.select} aria-label="Channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="push">App push</SelectItem>
                </SelectContent>
              </Select>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
                <SelectTrigger className={styles.select} aria-label="Result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <Select value={state} onValueChange={(v) => setState(v as State)}>
              <SelectTrigger className={styles.select} aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Student name or id"
            aria-label="Search by student name or id"
          />
        </div>
      </div>

      {ledger.error ? (
        <div className={styles.error}>{ledger.error instanceof Error ? ledger.error.message : "Could not load the ledger"}</div>
      ) : !data ? (
        <Skeleton className={styles.tableSkeleton} />
      ) : data.total === 0 ? (
        <div className={styles.empty}>
          {view === "messages"
            ? "No messages match. Real messages appear here as the autopilot sends them, every 15 minutes between 09:00 and 22:00."
            : "Nobody matches these filters."}
        </div>
      ) : (
        <div className={styles.tableScroll}>
          {view === "messages" ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Student</th>
                  <th>Playbook</th>
                  <th>Channel</th>
                  <th>Result</th>
                  <th className={styles.num}>Offer</th>
                  <th className={styles.num}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.messages.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.nowrap}>{when(row.sentAt ?? row.createdAt)}</td>
                    <td>
                      <Student id={row.userId} name={row.userName} onOpen={setJourneyUser} />
                    </td>
                    <td>
                      {playbookLabel(row.playbook)}
                      <div className={styles.muted}>
                        Message {row.step}
                        {row.variant ? `, version ${row.variant.toUpperCase()}` : ""}
                      </div>
                    </td>
                    <td>
                      {CHANNEL_LABEL[row.channel] ?? row.channel}
                      {row.template ? <div className={styles.muted}>{row.template}</div> : null}
                    </td>
                    <td>
                      <MessageResult row={row} />
                      {row.reason && row.status !== "sent" ? <div className={styles.muted}>{reasonLabel(row.reason)}</div> : null}
                      {row.repliedAt ? <div className={styles.muted}>Replied {when(row.repliedAt)}</div> : null}
                    </td>
                    <td className={styles.num}>{row.offerCoins ? `${row.offerCoins} Tcoins` : "-"}</td>
                    <td className={styles.num}>{row.costRupees > 0 ? `Rs ${row.costRupees.toFixed(2)}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Playbook</th>
                  <th>Status</th>
                  <th className={styles.num}>Messages sent</th>
                  <th>Last message</th>
                  <th>Joined playbook</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((row) => (
                  <tr key={row.enrolmentId}>
                    <td>
                      <Student id={row.userId} name={row.userName} onOpen={setJourneyUser} />
                    </td>
                    <td>{playbookLabel(row.playbook)}</td>
                    <td>
                      <PersonStatus row={row} />
                    </td>
                    <td className={styles.num}>{row.messagesSent}</td>
                    <td className={styles.nowrap}>{when(row.lastMessageAt)}</td>
                    <td className={styles.nowrap}>{when(row.triggerAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {data && data.total > 0 ? (
        <div className={styles.pager}>
          <span className={styles.muted}>
            {data.total.toLocaleString("en-IN")} {view === "messages" ? "messages" : "people"}, page {data.page} of {pages}
          </span>
          <div className={styles.pagerButtons}>
            <Button size="sm" variant="outline" disabled={page <= 1 || ledger.isFetching} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages || ledger.isFetching} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <AutopilotJourney userId={journeyUser} onClose={() => setJourneyUser(null)} />
    </div>
  );
}
