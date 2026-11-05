import { z } from "zod";
import superjson from "superjson";

export const LEDGER_OUTCOMES = ["all", "sent", "skipped", "failed", "clicked", "ordered", "shadow"] as const;
export const LEDGER_STATES = ["active", "finished", "held_out"] as const;

export const schema = z.object({
  view: z.enum(["messages", "people"]).default("messages"),
  playbook: z.string().max(40).optional(),
  channel: z.enum(["email", "whatsapp", "push"]).optional(),
  outcome: z.enum(LEDGER_OUTCOMES).default("all"),
  state: z.enum(LEDGER_STATES).default("active"),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type InputType = z.input<typeof schema>;

export type LedgerMessage = {
  id: number;
  createdAt: Date;
  sentAt: Date | null;
  userId: number;
  userName: string | null;
  playbook: string;
  step: number;
  variant: string | null;
  channel: string;
  template: string | null;
  status: string;
  reason: string | null;
  shadow: boolean;
  costRupees: number;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  clicks: number;
  repliedAt: Date | null;
  offerCoins: number | null;
  orderId: number | null;
  orderAmount: number | null;
};

export type LedgerPerson = {
  enrolmentId: number;
  userId: number;
  userName: string | null;
  playbook: string;
  heldOut: boolean;
  state: string;
  exitReason: string | null;
  nextStep: number | null;
  nextDueAt: Date | null;
  triggerAt: Date;
  messagesSent: number;
  lastMessageAt: Date | null;
  convertedOrderId: number | null;
  convertedAt: Date | null;
};

export type LedgerSummary = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  skipped: { reason: string; count: number }[];
  costRupees: number;
  offerCoins: number;
  orders: number;
  orderAmount: number;
  dueNextHour: number;
  dueToday: number;
};

export type OutputType = {
  view: "messages" | "people";
  page: number;
  pageSize: number;
  total: number;
  playbooks: { key: string; label: string }[];
  summary: LedgerSummary;
  messages: LedgerMessage[];
  people: LedgerPerson[];
};

export const getAdminAutopilotLedger = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const result = await fetch(`/_api/admin/autopilot/ledger?${search.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not load the ledger");
  return body as OutputType;
};
