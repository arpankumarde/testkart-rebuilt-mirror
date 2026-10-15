import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type ClaimContactOption = {
  method: "phone" | "email";
  // The exact value to send back on claim/start - never shown in full.
  value: string;
  masked: string;
};

export type OutputType = {
  organizationName: string;
  claimStatus: "unclaimed" | "pending_verification" | "claimed";
  // False once the org already has an owner, or already has a pending claim
  // from someone else.
  canClaim: boolean;
  // Empty when the listing has no verifiable contact at all - this is the
  // rare case that needs a human (admin) to review manually instead of the
  // automatic flow.
  options: ClaimContactOption[];
};

export const getTeacherOrganizationsClaimOptions = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({ organizationId: String(validatedInput.organizationId) });
  const result = await fetch(`/_api/teacher/organizations/claim/options?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
