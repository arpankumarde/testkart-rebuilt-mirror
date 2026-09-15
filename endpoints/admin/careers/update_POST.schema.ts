import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number(),
  title: z.string().min(1).max(255).optional(),
  department: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
  experienceLevel: z.string().nullable().optional(),
  description: z.string().min(1).optional(),
  requirements: z.string().nullable().optional(),
  salaryRange: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  orderIndex: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postAdminCareerUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/careers/update`, {
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