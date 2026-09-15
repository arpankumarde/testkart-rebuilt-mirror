import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests } from "../../../helpers/schema";

export const schema = z
  .object({
    itemCount: z.number().int().min(1).max(50),
    title: z.string().min(3).optional(),
    description: z.string().max(200).optional(),
    examName: z.string().optional().nullable(),
    language: z.string().optional(),
    price: z.number().min(0).optional(),
    isFree: z.boolean().optional(),
    discountPrice: z.number().min(0).optional().nullable(),
    thumbnailUrl: z.string().optional().nullable(),
    thumbnailFileId: z.string().optional().nullable(),
    longDescription: z.string().optional().nullable(),
    subjects: z.array(z.string()).optional(),
    whatYouLearn: z.array(z.string()).optional().nullable(),
    requirements: z.array(z.string()).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.isFree) {
        return (
          (data.price ?? 0) === 0 &&
          (data.discountPrice === null ||
            data.discountPrice === undefined ||
            data.discountPrice === 0)
        );
      }
      return true;
    },
    {
      message: "If test is free, both price and discount price must be 0",
      path: ["isFree"],
    }
  )
  .refine(
    (data) => {
      if (data.discountPrice !== null && data.discountPrice !== undefined) {
        return data.discountPrice <= (data.price ?? 0);
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

export const postTeacherTestsCreateWithItems = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/tests/create-with-items`, {
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