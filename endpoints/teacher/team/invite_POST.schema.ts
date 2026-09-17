import { z } from "zod";
import superjson from "superjson";

/** Managers an academy can have besides its owner, so a team is at most three people. */
export const MAX_TEAM_MANAGERS = 2;

/** Statuses that hold one of those seats. */
export const TEAM_SEAT_STATUSES = ["active", "pending"] as const;

export const schema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  // Same rule as the mobile OTP login form, the only way a member can sign in.
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

export type OutputType = {
  success: boolean;
  /** "active" when a new account was created, "pending" when an existing teacher has to accept. */
  status: "active" | "pending";
};

export const postTeacherTeamInvite = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/team/invite`, {
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