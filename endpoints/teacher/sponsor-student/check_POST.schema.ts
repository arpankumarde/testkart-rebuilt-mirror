import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  identifier: z.string().min(3, "Identifier must be at least 3 characters"),
  contentId: z.number(),
  contentType: z.enum(["test", "course", "product", "bundle"]),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  isValid: boolean;
  message?: string;
  user: {
    exists: boolean;
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
  const result = await fetch(`/_api/teacher/sponsor-student/check`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};