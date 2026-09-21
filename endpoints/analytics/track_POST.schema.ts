import { z } from "zod";
import superjson from "superjson";

export const StorefrontEventValues = ["view", "add_to_cart", "share"] as const;
export type StorefrontEvent = (typeof StorefrontEventValues)[number];

export const StorefrontEntityValues = [
  "mock_test",
  "live_test",
  "course",
  "digital_product",
  "bundle",
  "teacher_profile",
] as const;
export type StorefrontEntity = (typeof StorefrontEntityValues)[number];

export const StorefrontSharePlatformValues = [
  "whatsapp",
  "facebook",
  "x",
  "telegram",
  "linkedin",
  "email",
  "copy",
] as const;

const tag = z
  .string()
  .max(100)
  .nullish()
  .transform((value) => {
    const cleaned = (value ?? "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 60);
    return cleaned || null;
  });

/**
 * One storefront event from a browser. The teacher, the published check and
 * the traffic source are all worked out on the server from these fields; the
 * client never says whose item it is.
 */
export const schema = z
  .object({
    event: z.enum(StorefrontEventValues),
    entity: z.enum(StorefrontEntityValues),
    id: z.number().int().positive().optional(),
    slug: z.string().trim().min(1).max(200).optional(),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    utmSource: tag,
    utmMedium: tag,
    utmCampaign: tag,
    referrerHost: z
      .string()
      .max(253)
      .nullish()
      .transform((value) => (value ?? "").trim().toLowerCase().replace(/^www\./, "") || null),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
    /** Share events only: which share button was used, and the share surface's campaign. */
    platform: z.enum(StorefrontSharePlatformValues).optional(),
    campaign: tag,
  })
  .refine((input) => input.id !== undefined || input.slug !== undefined, { message: "id or slug is required" });

export type InputType = z.input<typeof schema>;

export const postStorefrontEvent = async (body: InputType, init?: RequestInit): Promise<void> => {
  await fetch(`/_api/analytics/track`, {
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