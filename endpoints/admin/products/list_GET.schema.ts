import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts, Users } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminProductListItem = Pick<
  Selectable<DigitalProducts>,
  | "id"
  | "title"
  | "slug"
  | "status"
  | "createdAt"
  | "totalPurchases"
  | "category"
  | "isPublished"
> & {
  price: number;
  teacherName: Selectable<Users>["displayName"];
  teacherId: Selectable<Users>["id"];
  filesCount: number;
  totalPages: number;
  /** False when a student would get nothing to download - see digitalProductRules. */
  hasRealFile: boolean;
};

export type OutputType = AdminProductListItem[];

export const getAdminProductsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/products/list`, {
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