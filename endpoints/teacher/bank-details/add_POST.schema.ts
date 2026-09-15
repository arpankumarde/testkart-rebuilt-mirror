import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type TeacherBankDetails } from "../../../helpers/schema";

const MAX_BASE64_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const schema = z.object({
  bankAccountHolderName: z.string().min(2, "Account holder name is required."),
  bankAccountNumber: z.string().min(5, "Valid account number is required."),
  bankIfscCode: z
    .string()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "Invalid IFSC code format. It should be like SBIN0001234."
    ),
  bankName: z.string().min(2, "Bank name is required."),
  upiId: z
    .string()
    .regex(
      /^[\w.-]+@[\w.-]+$/,
      "Invalid UPI ID format. It should be like user@bank."
    )
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .regex(
      /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      "Invalid PAN format. It should be like ABCDE1234F."
    ),
  panCardImageBase64: z
    .string()
    .refine(
      (s) => {
        if (s.startsWith('https://')) return s.length <= MAX_IMAGE_SIZE_BYTES;
        if (s.startsWith('data:')) {
          const base64Data = s.split(',')[1] ?? '';
          const sizeInBytes = (base64Data.length * 3) / 4;
          return sizeInBytes <= MAX_BASE64_SIZE_BYTES;
        }
        return false;
      },
      `PAN card image must be a valid URL or a base64 string less than 5MB.`
    ),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TeacherBankDetails>;

export const postTeacherBankDetailsAdd = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/bank-details/add`, {
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