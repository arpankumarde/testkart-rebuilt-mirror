import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles, Users } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminBundleListItem = Pick<
  Selectable<CourseBundles>,
  | "id"
  | "title"
  | "slug"
  | "isPublished"
  | "publishedAt"
  | "createdAt"
> & {
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  teacherName: Selectable<Users>["displayName"];
  teacherId: Selectable<Users>["id"];
  itemsCount: number;
};

export type OutputType = AdminBundleListItem[];

export const getAdminBundlesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/bundles/list`, {
    method: "GET",
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