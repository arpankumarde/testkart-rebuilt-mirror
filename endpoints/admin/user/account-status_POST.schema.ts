import { z } from "zod";
import superjson from "superjson";
import type { AccountStatus } from "../../../helpers/accountStatus";

const userId = z.number().int().positive();
const reason = z
  .string()
  .trim()
  .min(5, "Give a reason of at least 5 characters. It is sent to the user.")
  .max(500, "Keep the reason under 500 characters.");

export const SUSPENSION_DAY_OPTIONS = [1, 3, 7, 15, 30, 90] as const;

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    userId,
    /** null keeps the account suspended until an admin reactivates it. */
    durationDays: z.number().int().min(1).max(365).nullable(),
    reason,
  }),
  z.object({ action: z.literal("ban"), userId, reason }),
  z.object({
    action: z.literal("reactivate"),
    userId,
    note: z.string().trim().max(500).optional(),
  }),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  userId: number;
  status: AccountStatus;
  suspendedUntil: Date | null;
  /** False when the account has no email address or the email failed. */
  emailSent: boolean;
};

export const postAdminAccountStatus = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/user/account-status`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};