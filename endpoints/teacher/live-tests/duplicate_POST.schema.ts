import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests } from "../../../helpers/schema";

export const schema = z
  .object({
    liveTestId: z.number().int().positive("Invalid live test ID."),
        startTime: z.union([z.coerce.date(), z.null()]).optional(),
    endTime: z.coerce.date(),
    registrationDeadline: z.union([z.coerce.date(), z.null()]).optional(),
  })
  .refine(
    (data) => {
      // Only validate if both registrationDeadline and startTime exist
      if (data.registrationDeadline && data.startTime) {
        return data.registrationDeadline < data.startTime;
      }
      return true;
    },
    {
      message: "Registration deadline must be before the start time.",
      path: ["registrationDeadline"],
    }
  )
  .refine(
    (data) => {
      // Only validate if startTime exists
      if (data.startTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "Start time must be before the end time.",
      path: ["startTime"],
    }
  );

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<
  Selectable<LiveTests>,
  "price" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize"
> & {
  price: number;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
};

export const postTeacherLiveTestsDuplicate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/live-tests/duplicate`, {
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