import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;

export type GalleryItemMediaType = "photo" | "video";

export type OrganizationGalleryItem = {
  id: number;
  mediaType: GalleryItemMediaType;
  url: string;
  fileId: string | null;
  caption: string | null;
  createdAt: Date;
};

export type OutputType = {
  items: OrganizationGalleryItem[];
};

export const getTeacherOrganizationsGalleryList = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(query);
  const params = new URLSearchParams({ organizationId: validatedInput.organizationId });
  const result = await fetch(`/_api/teacher/organizations/gallery/list?${params.toString()}`, {
    method: "GET",
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
