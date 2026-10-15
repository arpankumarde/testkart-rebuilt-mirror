import { z } from "zod";
import superjson from "superjson";
import { OrganizationTypeValues } from "../../teacher/organizations/create_POST.schema";

export const scrapedPlaceSchema = z.object({
  placeId: z.string().min(1),
  title: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  categories: z.array(z.string()).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().nullable().optional(),
  phoneUnformatted: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  emails: z.array(z.string()).nullable().optional(),
  totalScore: z.number().nullable().optional(),
  reviewsCount: z.number().nullable().optional(),
  permanentlyClosed: z.boolean().nullable().optional(),
  temporarilyClosed: z.boolean().nullable().optional(),
  searchString: z.string().nullable().optional(),
});

export type ScrapedPlaceSchemaInput = z.infer<typeof scrapedPlaceSchema>;

export const schema = z.object({
  places: z.array(scrapedPlaceSchema).min(1).max(1000),
  orgType: z.enum(OrganizationTypeValues).default("coaching"),
  source: z.string().trim().min(1).max(60).default("scraped_google_maps"),
});

export type InputType = z.infer<typeof schema>;

export type BulkImportSkipReason =
  | "missing_place_id"
  | "missing_name"
  | "permanently_closed"
  | "generic_placeholder_name"
  | "no_contact_info";

export type OutputType = {
  totalReceived: number;
  imported: number;
  updated: number;
  skipped: number;
  skippedReasons: Partial<Record<BulkImportSkipReason, number>>;
  skippedTitles: { title: string | null; reason: BulkImportSkipReason }[];
};

export const postAdminOrganizationsBulkImport = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/organizations/bulk-import`, {
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
