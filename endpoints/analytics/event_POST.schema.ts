import { z } from "zod";
import superjson from "superjson";
import { StorefrontEntityValues } from "./track_POST.schema";

/** Funnel events only a browser can see. Everything else is recorded on the server. */
export const ClientFunnelEventValues = [
  "add_to_cart_click",
  "login_wall_shown",
  "guest_cart_merged",
  "offer_shown",
  "exit_intent_shown",
] as const;
export type ClientFunnelEvent = (typeof ClientFunnelEventValues)[number];

export const schema = z.object({
  event: z.enum(ClientFunnelEventValues),
  entityType: z.enum(StorefrontEntityValues).optional(),
  entityId: z.number().int().positive().optional(),
  path: z.string().max(200).optional(),
  props: z
    .record(z.union([z.string().max(100), z.number(), z.boolean()]))
    .refine((value) => Object.keys(value).length <= 8, { message: "Too many props" })
    .optional(),
});

export type InputType = z.input<typeof schema>;

export const postAnalyticsEvent = async (body: InputType, init?: RequestInit): Promise<void> => {
  await fetch(`/_api/analytics/event`, {
    method: "POST",
    body: superjson.stringify(body),
    keepalive: true,
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
};