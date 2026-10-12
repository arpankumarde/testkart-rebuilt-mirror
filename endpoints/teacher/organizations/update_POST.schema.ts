import { z } from "zod";
import superjson from "superjson";
import { OrganizationTypeValues } from "./create_POST.schema";

export const organizationSocialLinksSchema = z.object({
  facebook: z.string().trim().max(300).optional(),
  twitter: z.string().trim().max(300).optional(),
  linkedin: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(300).optional(),
  youtube: z.string().trim().max(300).optional(),
});

export type OrganizationSocialLinks = z.infer<typeof organizationSocialLinksSchema>;

export const InstituteSizeValues = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
export type InstituteSizeValue = (typeof InstituteSizeValues)[number];

export const schema = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().trim().min(2).max(120).optional(),
  orgType: z.enum(OrganizationTypeValues).optional(),
  // Rich HTML from the organisation About editor (RichTextEditor). Bumped
  // from the old plain-text 2000-char cap to account for markup overhead -
  // sanitizeHtml() strips anything unsafe on save regardless.
  description: z.string().trim().max(20000).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  websiteUrl: z.string().trim().max(300).nullable().optional(),
  phoneNumber: z.string().trim().max(30).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  logoFileId: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  coverImageFileId: z.string().nullable().optional(),
  foundedYear: z.number().int().min(1800).max(2100).nullable().optional(),
  instituteSize: z.enum(InstituteSizeValues).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).max(20).nullable().optional(),
  socialLinks: organizationSocialLinksSchema.nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
};

export const postTeacherOrganizationsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/update`, {
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
