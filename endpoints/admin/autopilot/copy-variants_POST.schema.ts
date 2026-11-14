import { z } from "zod";
import superjson from "superjson";

const copy = z.object({
  subject: z.string().max(200),
  heading: z.string().max(200),
  body: z.string().max(1000),
  cta: z.string().max(100),
});
const playbookKey = z.string().regex(/^[a-z_]{1,40}$/);
const step = z.number().int().min(1).max(20);
const variantKey = z.string().regex(/^(a|b|v\d{1,9})$/);

/**
 * Message version actions. draft asks the AI for 1-3 drafts; create saves the admin's
 * own draft; edit changes a draft; approve puts a draft live (retireKey names the live
 * version it replaces when the step already has the maximum); retire takes a live
 * version out (one must stay); restore brings a retired one back; examples saves the
 * proven messages the AI learns tone from.
 */
export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), playbookKey, step, count: z.number().int().min(1).max(3), brief: z.string().max(500).optional() }),
  z.object({ action: z.literal("create"), playbookKey, step, copy }),
  z.object({ action: z.literal("edit"), id: z.number().int().positive(), copy }),
  z.object({ action: z.literal("approve"), id: z.number().int().positive(), retireKey: variantKey.optional() }),
  z.object({ action: z.literal("reject"), id: z.number().int().positive() }),
  z.object({ action: z.literal("retire"), playbookKey, step, key: variantKey }),
  z.object({ action: z.literal("restore"), playbookKey, step, key: variantKey, retireKey: variantKey.optional() }),
  z.object({ action: z.literal("examples"), examples: z.array(z.string().max(1500)).max(30) }),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  ok: true;
  message: string;
  /** For draft: drafts the AI wrote that broke the rules and were not saved. */
  rejected?: { copy: { subject: string; heading: string; body: string; cta: string }; problems: string[] }[];
};

export const postAdminAutopilotCopyVariants = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/copy-variants`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string; problems?: string[] }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) {
    const failure = parsed as { error?: string; problems?: string[] };
    const error = new Error(failure.error ?? "Could not save") as Error & { problems?: string[] };
    error.problems = failure.problems;
    throw error;
  }
  return parsed as OutputType;
};
