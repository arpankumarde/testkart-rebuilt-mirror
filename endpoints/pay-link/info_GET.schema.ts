import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ token: z.string().min(1).max(100) });

export type InputType = z.infer<typeof schema>;

export type PayLinkInfoItem = { title: string; kind: "test" | "course" | "digitalProduct"; price: number };

export type OutputType = {
  status: "open" | "paid" | "expired" | "nothing_to_pay";
  studentName: string;
  maskedPhone: string | null;
  items: PayLinkInfoItem[];
  listTotal: number;
  discount: number;
  amount: number;
  expiresAt: Date;
};

export const getPayLinkInfo = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/pay-link/info?token=${encodeURIComponent(params.token)}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not load this link");
  return body as OutputType;
};
