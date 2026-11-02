import { z } from "zod";
import superjson from "superjson";
import type { SponsorAccountCandidate } from "../../../helpers/sponsorStudentAccount";

export const schema = z.object({
  identifier: z.string().min(3, "Identifier must be at least 3 characters"),
  contentId: z.number(),
  contentType: z.enum(["test", "course", "product", "bundle"]),
  /** Picks one account when several student accounts share the identifier. */
  studentUserId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type SponsorAccountStatus = "student" | "multiple_students" | "not_student" | "not_found";

export type OutputType = {
  isValid: boolean;
  message?: string;
  user: {
    /** Exactly one account state per lookup; drives what the sponsor dialog shows. */
    status: SponsorAccountStatus;
    /** Why the account cannot be used, or what to do next (not_student, multiple_students). */
    statusMessage?: string;
    /** Set when several student accounts share the identifier. */
    candidates?: SponsorAccountCandidate[];
    exists: boolean;
    /** id and name are only sent for an eligible student account. */
    id?: number;
    name?: string;
    isStudent?: boolean;
    phoneNumber?: string;
    email?: string;
  };
  content: {
    title: string;
    price: number;
    isFree: boolean;
    contentType: string;
  };
  cost: {
    testPrice: number;
    platformFeePercentage: number;
    commissionAmount: number;
    formula: string;
    discountPrice: number | null;
  };
  teacher: {
    availableBalance: number;
    hasSufficientBalance: boolean;
    requiresPayment: boolean;
  };
  isFreeEnrollment: boolean;
  errors?: string[];
};

export const checkSponsorStudent = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  let result: Response;
  try {
    result = await fetch(`/_api/teacher/sponsor-student/check`, {
      method: "POST",
      body: superjson.stringify(body),
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Could not reach Testkart. Check your connection and try again.");
  }
  if (!result.ok) {
    let message = "Could not check this account right now. Please try again.";
    try {
      message = superjson.parse<{ error: string }>(await result.text()).error || message;
    } catch {
      // Non-JSON body (gateway or proxy error); keep the generic message.
    }
    throw new Error(message);
  }
  return superjson.parse<OutputType>(await result.text());
};