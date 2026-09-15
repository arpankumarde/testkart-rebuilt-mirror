import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests } from "../../../helpers/schema";

// Every optional field is written only when the request carries it (see
// buildMockTestUpdateSet), so no field here may take a default value.
export const schema = z.object({
  testId: z.number(),
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters long.")
    .max(200, "Short bio must not exceed 200 characters"),
  subjects: z.array(z.string().min(1)).optional(),
  price: z.number().min(0, "Price cannot be negative."),
  discountPrice: z.number().min(0, "Discount price cannot be negative.").optional().nullable(),
  isFree: z.boolean().optional(),
  thumbnailUrl: z.string().optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  introVideoUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  introVideoFileId: z.string().optional().nullable(),
  language: z.string().min(1, "Language is required.").optional(),
  whatYouLearn: z.array(z.string().min(1)).optional().nullable(),
  requirements: z.array(z.string().min(1)).optional().nullable(),
  longDescription: z.string().optional().nullable(),
  examName: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.isFree) {
      return data.price === 0 && (data.discountPrice === null || data.discountPrice === undefined || data.discountPrice === 0);
    }
    return true;
  },
  {
    message: "If test is free, both price and discount price must be 0",
    path: ["isFree"],
  }
).refine(
  (data) => {
    if (data.discountPrice !== null && data.discountPrice !== undefined) {
      return data.discountPrice <= data.price;
    }
    return true;
  },
  {
    message: "Discount price must be less than or equal to price",
    path: ["discountPrice"],
  }
);

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<
  Selectable<MockTests>,
  "price" | "rating" | "discountPrice"
> & {
  price: number;
  rating: number | null;
  discountPrice: number | null;
};

export const postTeacherTestsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/tests/update`, {
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