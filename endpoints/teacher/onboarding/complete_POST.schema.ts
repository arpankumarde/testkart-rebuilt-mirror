import { z } from "zod";
import superjson from "superjson";
import { User } from "../../../helpers/User";

export const schema = z.object({
  teachingCategories: z.array(z.string()).min(1),
  subjects: z.array(z.string()).min(1),
  targetExams: z.array(z.string()).min(1),
  teachingExperienceLevel: z.string(),
  currentOccupation: z.string(),
  contentTypes: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1),
  goals: z.string(),
  discoverySource: z.string(),
  
  academyName: z.string().optional(),
  schoolCollegeName: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().optional(),
  socialLinks: z
    .object({
      youtube: z.string().optional(),
      telegram: z.string().optional(),
      instagram: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
  signupSource: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = User;

export const postTeacherOnboardingComplete = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/onboarding/complete`, {
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