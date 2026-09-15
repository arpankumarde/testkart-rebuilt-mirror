import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type StudentBankDetails } from "../../../helpers/schema";

export const schema = z
  .object({
    bankDetailsId: z.number().int().positive(),
    action: z.enum(["verify", "reject"]),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.action === "reject") {
        return data.rejectionReason && data.rejectionReason.trim().length > 0;
      }
      return true;
    },
    {
      message: "Rejection reason is required when rejecting bank details.",
      path: ["rejectionReason"],
    }
  );

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<StudentBankDetails>;

export const postAdminVerifyStudentBankDetails = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/student-bank-details/verify`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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