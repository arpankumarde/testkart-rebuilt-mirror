import { z } from "zod";
import superjson from "superjson";

export const OrganizationTypeValues = ["coaching", "school", "college", "university", "other"] as const;
export type OrganizationTypeValue = (typeof OrganizationTypeValues)[number];

export const schema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(120, "Keep the name under 120 characters."),
  orgType: z.enum(OrganizationTypeValues),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(160).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  organization: {
    id: string;
    name: string;
    slug: string;
    orgType: OrganizationTypeValue;
  };
};

export const postTeacherOrganizationsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/create`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
