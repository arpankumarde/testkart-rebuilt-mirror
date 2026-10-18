import { z } from "zod";
import superjson from "superjson";
import { OrganizationTypeValues } from "../../teacher/organizations/create_POST.schema";

/**
 * Flat, human/CSV-friendly shape for one organisation row. This is distinct
 * from bulk-import_POST.schema.ts (which expects raw scraper/Apify place
 * objects) - this one is meant to be filled in a spreadsheet by an admin, or
 * generated from a dataset like AISHE's college/university lists.
 */
export const bulkOrgRowSchema = z.object({
  name: z.string().trim().min(1).max(300),
  orgType: z.enum(OrganizationTypeValues),
  description: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  websiteUrl: z.string().trim().max(500).nullable().optional(),
  phoneNumber: z.string().trim().max(100).nullable().optional(),
  foundedYear: z.coerce.number().int().min(1000).max(3000).nullable().optional(),
  // For orgType === "college": the name of the university this college is
  // affiliated to. Resolved (or created, if no matching university exists
  // yet) server-side into affiliatedUniversityId.
  affiliatedUniversityName: z.string().trim().max(300).nullable().optional(),
  contactEmails: z.string().trim().max(1000).nullable().optional(),
  specialties: z.string().trim().max(1000).nullable().optional(),
  // Optional stable external identifier (e.g. an AISHE code, a government
  // registry ID). When provided, re-uploading a CSV with the same
  // externalId updates the existing unclaimed row instead of duplicating
  // it; rows a teacher has since claimed are left untouched.
  externalId: z.string().trim().max(120).nullable().optional(),
});

export type BulkOrgRowInput = z.infer<typeof bulkOrgRowSchema>;

export const schema = z.object({
  rows: z.array(bulkOrgRowSchema).min(1).max(60000),
  source: z.string().trim().min(1).max(60).default("admin_csv_upload"),
});

export type InputType = z.infer<typeof schema>;

export type BulkOrgSkipReason = "missing_name" | "invalid_org_type";

export type OutputType = {
  totalReceived: number;
  imported: number;
  updated: number;
  universitiesCreated: number;
  skipped: number;
  skippedRows: { row: number; name: string | null; reason: string }[];
};

export const postAdminOrganizationsBulkUpload = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/organizations/bulk-upload`, {
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
