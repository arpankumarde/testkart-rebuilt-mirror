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

export const schema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.preprocess(emptyRichTextToNull, z.string().max(2000).nullable().optional()),
    language: z.string().max(100).optional().nullable(),
    subject: z.string().optional().nullable(),
    durationMinutes: z.number().int().min(0),
    price: z.number().min(0),
    discountPrice: z.number().min(0).optional().nullable(),
    isFree: z.boolean().optional().default(false),
    whatYouLearn: z.array(z.string()).optional().nullable(),
    requirements: z.array(z.string()).optional().nullable(),
    startTime: z.coerce.date().optional().nullable(),
    endTime: z.coerce.date(),
    registrationDeadline: z.coerce.date().optional().nullable(),
    maxSeats: z.number().int().min(1),
    thumbnailUrl: z.preprocess(blankToNull, z.string().url().nullable().optional()),
    thumbnailFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    introVideoUrl: z.preprocess(blankToNull, z.string().url().nullable().optional()),
    introVideoFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    calculatorEnabled: z.boolean().optional().default(false),
    subjectWiseTiming: z.boolean().optional().default(false),
    questionWiseTiming: z.boolean().optional().default(false),
    hasPrizes: z.boolean().optional().default(false),
    prizeTiers: z.array(prizeTierSchema).optional().default([]),
    examName: z.string().optional().nullable(),
  })
  .refine((data) => {
    // Only validate if both registrationDeadline and startTime exist
    if (data.registrationDeadline && data.startTime) {
      return data.registrationDeadline < data.startTime;
    }
    return true;
  }, {
    message: "Registration deadline must be before the start time.",
    path: ["registrationDeadline"],
  })
  .refine((data) => {
    // Only validate if startTime exists
    if (data.startTime) {
      return data.startTime < data.endTime;
    }
    return true;
  }, {
    message: "Start time must be before the end time.",
    path: ["startTime"],
  })
  .refine(
    (data) => {
      if (data.hasPrizes) {
        return validatePrizeTiers(data.prizeTiers) === null;
      }
      return true;
    },
    {
      message: "Prize rank ranges must be valid (rank 1 or higher, end >= start, no overlaps).",
      path: ["prizeTiers"],
    }
  )
  .refine((data) => {
    if (!data.subjectWiseTiming && !data.questionWiseTiming) {
      return data.durationMinutes >= 1;
    }
    return true;
  }, {
    message: "Duration must be at least 1 minute.",
    path: ["durationMinutes"],
  })
  .refine(
    (data) => {
      if (data.isFree) {
        return (
          data.price === 0 &&
          (data.discountPrice === null || data.discountPrice === undefined || data.discountPrice === 0)
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
      if (data.discountPrice !== null && data.discountPrice !== undefined) {
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

export type OutputType = Omit<Selectable<LiveTests>, "price" | "discountPrice" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize" | "prizeTiers"> & {
  price: number;
  discountPrice: number | null;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  prizeTiers: PrizeTier[];
};

export const postTeacherLiveTestsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/live-tests/create`, {
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