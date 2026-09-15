import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CareerPostings } from "../../../helpers/schema";

export const schema = z.object({
  title: z.string().min(1).max(255),
  department: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  experienceLevel: z.string().optional(),
  description: z.string().min(1),
  requirements: z.string().optional(),
  salaryRange: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  career: Selectable<CareerPostings>;
};

export const postAdminCareerCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/careers/create`, {
    method: "POST",
    body: superjson.stringify(body),
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