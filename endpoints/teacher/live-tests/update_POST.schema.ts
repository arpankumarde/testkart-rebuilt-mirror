import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests } from "../../../helpers/schema";
import { validatePrizeTiers, PrizeTier } from "../../../helpers/liveTestPrizeTiers";
import { isEmptyRichText } from "../../../helpers/liveTestCreationFormSchema";

const prizeTierSchema = z.object({
  rankFrom: z.number().int().min(1),
  rankTo: z.number().int().min(1),
  amountPerRank: z.number().min(0),
});

const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
const emptyRichTextToNull = (value: unknown) => (typeof value === "string" && isEmptyRichText(value) ? null : value);

// A partial update: every field is optional and only the ones sent are written.
// The backing mock test is never client-controlled; the handler always writes to
// the mock test stored on the live test. Checks that need stored values (the
// published lock, merged schedule, pricing and timing rules) run in
// helpers/liveTestUpdate.tsx.
export const schema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(3).max(100).optional(),
    description: z.preprocess(emptyRichTextToNull, z.string().max(2000).nullable().optional()),
    examName: z.string().optional().nullable(),
    language: z.string().max(100).optional().nullable(),
    price: z.number().min(0).optional(),
    discountPrice: z.number().min(0).optional().nullable(),
    isFree: z.boolean().optional(),
    whatYouLearn: z.array(z.string()).optional().nullable(),
    requirements: z.array(z.string()).optional().nullable(),
    startTime: z.coerce.date().optional().nullable(),
    endTime: z.coerce.date().optional(),
    registrationDeadline: z.coerce.date().optional().nullable(),
    maxSeats: z.number().int().min(1).optional(),
    thumbnailUrl: z.preprocess(blankToNull, z.string().url().nullable().optional()),
    thumbnailFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    introVideoUrl: z.preprocess(blankToNull, z.string().url().nullable().optional()),
    introVideoFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    calculatorEnabled: z.boolean().optional(),
    subjectWiseTiming: z.boolean().optional(),
    questionWiseTiming: z.boolean().optional(),
    hasPrizes: z.boolean().optional(),
    prizeTiers: z.array(prizeTierSchema).optional(),
    durationMinutes: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime !== undefined && data.startTime !== null && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "Start time must be before end time.",
      path: ["startTime"],
    }
  )
  .refine(
    (data) => {
      if (data.registrationDeadline !== undefined && data.registrationDeadline !== null &&
          data.startTime !== undefined && data.startTime !== null) {
        return data.registrationDeadline < data.startTime;
      }
      return true;
    },
    {
      message: "Registration deadline must be before start time.",
      path: ["registrationDeadline"],
    }
  )
  .refine(
    (data) => {
      if (data.hasPrizes === true && data.prizeTiers !== undefined) {
        return validatePrizeTiers(data.prizeTiers) === null;
      }
      return true;
    },
    {
      message: "Prize rank ranges must be valid (rank 1 or higher, end >= start, no overlaps).",
      path: ["prizeTiers"],
    }
  )
  .refine(
    (data) => {
      if (data.isFree === true) {
        return (
          (data.price === undefined || data.price === 0) &&
          (data.discountPrice === undefined || data.discountPrice === null || data.discountPrice === 0)
        );
      }
      return true;
    },
    {
      message: "If the test is free, both price and discount price must be 0.",
      path: ["isFree"],
    }
  )
  .refine(
    (data) => {
      if (data.discountPrice !== undefined && data.discountPrice !== null && data.price !== undefined) {
        return data.discountPrice <= data.price;
      }
      return true;
    },
    {
      message: "Discount price must be less than or equal to price.",
      path: ["discountPrice"],
    }
  );

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<LiveTests>, "price" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize" | "discountPrice" | "prizeTiers"> & {
  price: number;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  discountPrice: number | null;
  prizeTiers: PrizeTier[];
};

export const postTeacherLiveTestsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/live-tests/update`, {
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
