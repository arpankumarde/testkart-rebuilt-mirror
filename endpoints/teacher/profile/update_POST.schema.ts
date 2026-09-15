import { z } from "zod";
import superjson from "superjson";
import { User } from "../../../helpers/User";

export const schema = z
  .object({
    displayName: z.string().min(1, "Display name cannot be empty.").optional(),
    slug: z.string()
      .min(1, "Profile URL slug cannot be empty.")
      .min(3, "Slug must be at least 3 characters.")
      .max(100, "Slug must be 100 characters or less.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
    avatarUrl: z.string().url("Invalid URL for avatar.").optional().nullable(),
    avatarFileId: z.string().optional().nullable(),
    bio: z.string().optional(),
        websiteUrl: z.string().optional().nullable().transform((val) => {
      if (!val || val === '') return val;
      // Auto-prepend https:// if no protocol is specified
      return val.match(/^https?:\/\//) ? val : `https://${val}`;
    }),
    publicEmail: z.union([
      z.string().email("Invalid email address."),
      z.literal(""),
      z.null(),
    ]).optional(),
    publicPhone: z.string().optional().nullable(),
    socialLinks: z
      .object({
        facebook: z.string().optional(),
        twitter: z.string().optional(),
        linkedin: z.string().optional(),
        instagram: z.string().optional(),
        youtube: z.string().optional(),
      })
      .optional(),
    awardsCertificates: z
      .array(
        z.object({
          title: z.string().min(1, "Title is required."),
          description: z.string().optional(),
        })
      )
      .optional(),
    languages: z.array(z.string()).optional(),
    location: z.string().optional().nullable(),
    expertiseAreas: z.array(z.string()).optional(),
    responseTime: z.string().optional().nullable(),
    tagline: z.string().optional().nullable(),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = User;

export const postTeacherProfileUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/profile/update`, {
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