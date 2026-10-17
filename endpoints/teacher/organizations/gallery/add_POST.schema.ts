import { z } from "zod";
import superjson from "superjson";
import type { OrganizationGalleryItem } from "./list_GET.schema";

export const schema = z.object({
  organizationId: z.string().uuid(),
  mediaType: z.enum(["photo", "video"]),
  url: z.string().trim().min(1).max(2000),
  fileId: z.string().trim().max(500).nullable().optional(),
  caption: z.string().trim().max(200).nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  item: OrganizationGalleryItem;
};

export const postTeacherOrganizationsGalleryAdd = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/gallery/add`, {
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
