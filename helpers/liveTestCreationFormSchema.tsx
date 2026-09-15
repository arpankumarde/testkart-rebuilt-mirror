import { z } from 'zod';
import { validatePrizeTiers } from './liveTestPrizeTiers';

const prizeTierSchema = z.object({
  rankFrom: z.number().int().min(1),
  rankTo: z.number().int().min(1),
  amountPerRank: z.number().min(0),
});

/** True when rich text has no visible content; the editor emits "<p></p>" for an
 * empty document. */
export const isEmptyRichText = (html: string | null | undefined): boolean => {
  if (!html) return true;
  if (/<(img|iframe|video|audio|table|hr)\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim().length === 0;
};

// Uploaders report a removed file as '' or null, and an emptied editor as
// "<p></p>". All of them mean "not set", so they validate as null.
const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);
const emptyRichTextToNull = (value: unknown) => (typeof value === 'string' && isEmptyRichText(value) ? null : value);

// Form schema for the live test create and edit wizards. Description is optional,
// matching the review step, which lists a missing description as optional.
export const liveTestCreationFormSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters.').max(100, 'Title must be 100 characters or fewer.'),
    description: z.preprocess(
      emptyRichTextToNull,
      z.string().max(2000, 'Description must be 2000 characters or fewer, including formatting.').nullable().optional()
    ),
    language: z.string().optional(),
    durationMinutes: z.number().int().min(0, "Duration must be 0 or more."),
    calculatorEnabled: z.boolean().optional().default(false),
    subjectWiseTiming: z.boolean().optional().default(false),
    questionWiseTiming: z.boolean().optional().default(false),
    price: z.number().min(0, 'Price cannot be negative.'),
    discountPrice: z.number().min(0, 'Discount price cannot be negative.').optional().nullable(),
    isFree: z.boolean().optional().default(false),
    whatYouLearn: z.array(z.string()).optional().nullable(),
    requirements: z.array(z.string()).optional().nullable(),
    startTime: z.coerce.date().optional().nullable(),
    endTime: z.coerce.date(),
    registrationDeadline: z.coerce.date().optional().nullable(),
    maxSeats: z.number().int().min(1, 'Max seats must be at least 1.'),
    thumbnailUrl: z.preprocess(blankToNull, z.string().url('Thumbnail must be a valid URL.').nullable().optional()),
    thumbnailFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    introVideoUrl: z.preprocess(blankToNull, z.string().url('Intro video must be a valid URL.').nullable().optional()),
    introVideoFileId: z.preprocess(blankToNull, z.string().nullable().optional()),
    hasPrizes: z.boolean().optional().default(false),
    prizeTiers: z.array(prizeTierSchema).optional().default([]),
    examName: z.string().optional().nullable(),
  })
  .refine((data) => {
    if (data.registrationDeadline && data.startTime) {
      return data.registrationDeadline < data.startTime;
    }
    return true;
  }, {
    message: "Registration deadline must be before the start time.",
    path: ["registrationDeadline"],
  })
  .refine((data) => {
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
    (data) => ({
      message: validatePrizeTiers(data.prizeTiers) ?? "Invalid prize tiers.",
      path: ["prizeTiers"],
    })
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

export type LiveTestFormValues = z.infer<typeof liveTestCreationFormSchema>;
