import { z } from "zod";
import superjson from "superjson";
import { MAX_MASTERCLASS_CO_HOSTS } from "../../../helpers/masterclassCoHosts";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  slug: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(3, "Title is required"),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  coverImageUrl: z.string().trim().optional(),
  coverImageFileId: z.string().trim().optional(),
  /** Ignored: the host's name comes from the admin account chosen in hostAdminId. */
  hostName: z.string().trim().optional(),
  /** The admin presenting. Omitted means the admin saving the form. */
  hostAdminId: z.number().int().positive().optional(),
  hostTitle: z.string().trim().optional(),
  hostImageUrl: z.string().trim().optional(),
  platformLabel: z.string().trim().optional(),
  joinUrl: z.string().trim().optional(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "cancelled"]),
  /**
   * Omitted leaves the stored co-hosts untouched; an empty list clears them.
   * An admin co-host sends only its id and title: name and photo are read from
   * the account on the server.
   */
  coHosts: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("admin"),
          userId: z.number().int().positive(),
          title: z.string().trim().max(80).optional(),
        }),
        z.object({
          type: z.literal("guest"),
          name: z.string().trim().min(2, "Enter the guest's full name").max(80),
          title: z.string().trim().max(80).optional(),
          profileImage: z.string().trim().max(500).optional(),
          imageFileId: z.string().trim().max(300).optional(),
          organization: z.string().trim().max(120).optional(),
          website: z.string().trim().max(300).optional(),
        }),
      ])
    )
    .max(MAX_MASTERCLASS_CO_HOSTS, `Up to ${MAX_MASTERCLASS_CO_HOSTS} co-hosts`)
    .optional(),
});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  id: number;
};

export const postAdminMasterclassUpsert = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/masterclasses/upsert`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
