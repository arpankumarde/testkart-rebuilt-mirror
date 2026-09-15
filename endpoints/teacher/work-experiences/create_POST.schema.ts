import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWorkExperiences } from "../../../helpers/schema";

export const schema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  position: z.string().min(1, "Position is required"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().nullable().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<TeacherWorkExperiences>;

export const createWorkExperience = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/work-experiences/create`, {
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