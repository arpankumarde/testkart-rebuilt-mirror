import { sql } from "kysely";
import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import { HomepageNoteItem } from "../endpoints/homepage/data_GET.schema";

export async function homepageFetchPopularNotes(): Promise<HomepageNoteItem[]> {
  const notes = await db
    .selectFrom("digitalProducts")
    .innerJoin("users", "users.id", "digitalProducts.teacherId")
    .where("digitalProducts.status", "=", "published")
    .where("digitalProducts.isPublished", "=", true)
    .select((eb) => [
      "digitalProducts.id",
      "digitalProducts.title",
      "digitalProducts.slug",
      "digitalProducts.price",
      "digitalProducts.totalPurchases",
      "digitalProducts.rating",
      "digitalProducts.pageCount",
      "digitalProducts.views",
      "digitalProducts.examName",
      "users.displayName as teacherName",
      "users.slug as teacherSlug",
      "users.avatarUrl as teacherAvatarUrl",
      "users.tagline as teacherTagline",
      "users.yearsOfExperience as teacherYearsOfExperience",
      "users.isVerified as teacherIsVerified",
      sql<number>`(SELECT COUNT(*) FROM digital_product_purchases WHERE product_id = digital_products.id AND purchased_at > NOW() - INTERVAL '7 days') * 3 + (SELECT COUNT(*) FROM digital_product_purchases WHERE product_id = digital_products.id AND purchased_at > NOW() - INTERVAL '30 days')`.as("recentActivityScore"),
    ])
    .orderBy("recentActivityScore", "desc")
    .orderBy(sql`COALESCE(digital_products.views, 0)`, "desc")
    .limit(8)
    .execute();

  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    slug: n.slug,
    price: Number(n.price),
    totalPurchases: n.totalPurchases || 0,
    rating: n.rating != null ? Number(n.rating) : null,
    pageCount: n.pageCount,
    teacherName: n.teacherName,
    teacherSlug: n.teacherSlug,
    teacherAvatarUrl: sanitizeUrl(n.teacherAvatarUrl),
    teacherTagline: n.teacherTagline,
    teacherYearsOfExperience: n.teacherYearsOfExperience,
    teacherIsVerified: n.teacherIsVerified,
      views: Number(n.views ?? 0),
   examName: n.examName ?? null,
  }));
}