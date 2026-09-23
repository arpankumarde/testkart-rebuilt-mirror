import { db } from "./db";

export type TeacherProfileBundle = {
  id: number;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number;
  itemCount: number;
};

/**
 * A teacher's published bundles for the expert profile. Shared by
 * endpoints/teachers/profile_GET.ts and helpers/fetchTeacherProfileServer.tsx
 * so the two payloads stay identical.
 */
export async function loadTeacherProfileBundles(teacherId: number): Promise<TeacherProfileBundle[]> {
  const rows = await db
    .selectFrom("courseBundles")
    .select((eb) => [
      "courseBundles.id",
      "courseBundles.slug",
      "courseBundles.title",
      "courseBundles.thumbnailUrl",
      "courseBundles.price",
      "courseBundles.originalPrice",
      eb
        .selectFrom("courseBundleItems")
        .select((eb2) => eb2.fn.countAll<string>().as("count"))
        .whereRef("courseBundleItems.bundleId", "=", "courseBundles.id")
        .as("itemCount"),
    ])
    .where("courseBundles.teacherId", "=", teacherId)
    .where("courseBundles.isPublished", "=", true)
    .orderBy("courseBundles.createdAt", "desc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    price: Number(row.price),
    originalPrice: Number(row.originalPrice),
    itemCount: Number(row.itemCount ?? 0),
  }));
}