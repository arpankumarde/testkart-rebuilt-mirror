import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  schema,
  OutputType,
  OrganizationTeacherCard,
  OrgCatalogueItem,
  OrganizationPost,
} from "./profile_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { courseDiscountPrice } from "../../helpers/coursePricing";

const CATALOGUE_LIMIT_PER_KIND = 24;
const POSTS_LIMIT = 20;

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({ orgSlug: url.searchParams.get("orgSlug") });

    const org = await db
      .selectFrom("organizations")
      .selectAll()
      .where("slug", "=", input.orgSlug)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch {
      // Public, unauthenticated-ok endpoint.
    }

    const teacherRows = await db
      .selectFrom("organizationTeachers")
      .innerJoin("users", "users.id", "organizationTeachers.teacherId")
      .select([
        "users.id",
        "users.slug",
        "users.displayName",
        "users.avatarUrl",
        "users.tagline",
        "users.isVerified",
        "users.yearsOfExperience",
        "users.expertiseAreas",
      ])
      .where("organizationTeachers.organizationId", "=", org.id)
      .where("organizationTeachers.status", "=", "approved")
      .orderBy("users.displayName", "asc")
      .execute();

    const teacherIds = teacherRows.map((t) => t.id);

    const teacherRatingRows =
      teacherIds.length > 0
        ? (
            await sql<{ teacherId: number; avgRating: number | null; ratingCount: number }>`
              SELECT COALESCE(c.teacher_id, dp.teacher_id, mt.teacher_id) AS "teacherId",
                     AVG(r.rating) AS "avgRating",
                     COUNT(*) AS "ratingCount"
              FROM reviews r
              LEFT JOIN courses c ON c.id = r.course_id
              LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
              LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
              WHERE COALESCE(c.teacher_id, dp.teacher_id, mt.teacher_id) IN (${sql.join(teacherIds)})
              GROUP BY 1
            `.execute(db)
          ).rows
        : [];
    const ratingByTeacher = new Map(teacherRatingRows.map((row) => [Number(row.teacherId), row]));

    const teachers: OrganizationTeacherCard[] = teacherRows.map((t) => {
      const ratingRow = ratingByTeacher.get(t.id);
      return {
        id: t.id,
        slug: t.slug,
        displayName: t.displayName,
        avatarUrl: t.avatarUrl,
        tagline: t.tagline,
        isVerified: !!t.isVerified,
        yearsOfExperience: t.yearsOfExperience,
        subjects: Array.isArray(t.expertiseAreas)
          ? (t.expertiseAreas as unknown[]).filter((s): s is string => typeof s === "string" && s.trim() !== "")
          : [],
        rating: ratingRow?.avgRating != null ? Number(ratingRow.avgRating) : null,
        ratingCount: Number(ratingRow?.ratingCount ?? 0),
      };
    });

    const catalogue: OrgCatalogueItem[] = [];

    if (teacherIds.length > 0) {
      const [courses, tests, liveTests, products, bundles] = await Promise.all([
        db
          .selectFrom("courses")
          .innerJoin("users", "users.id", "courses.teacherId")
          .select([
            "courses.id",
            "courses.slug",
            "courses.title",
            "courses.examName",
            "courses.price",
            "courses.discountPrice",
            "courses.thumbnailImageUrl",
            "courses.rating",
            "users.displayName as teacherName",
            "users.slug as teacherSlug",
            "users.avatarUrl as teacherAvatarUrl",
            "users.tagline as teacherTagline",
            "users.yearsOfExperience as teacherYearsOfExperience",
            "users.isVerified as teacherIsVerified",
          ])
          .where("courses.status", "=", "published")
          .where("courses.teacherId", "in", teacherIds)
          .orderBy("courses.createdAt", "desc")
          .limit(CATALOGUE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("mockTests")
          .innerJoin("users", "users.id", "mockTests.teacherId")
          .select([
            "mockTests.id",
            "mockTests.slug",
            "mockTests.title",
            "mockTests.examName",
            "mockTests.price",
            "mockTests.discountPrice",
            "mockTests.thumbnailUrl",
            "mockTests.rating",
            "users.displayName as teacherName",
            "users.slug as teacherSlug",
            "users.avatarUrl as teacherAvatarUrl",
            "users.tagline as teacherTagline",
            "users.yearsOfExperience as teacherYearsOfExperience",
            "users.isVerified as teacherIsVerified",
          ])
          .where("mockTests.isPublished", "=", true)
          .where("mockTests.deletedAt", "is", null)
          .where("mockTests.teacherId", "in", teacherIds)
          .orderBy("mockTests.createdAt", "desc")
          .limit(CATALOGUE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("liveTests")
          .innerJoin("users", "users.id", "liveTests.teacherId")
          .select([
            "liveTests.id",
            "liveTests.title",
            "liveTests.price",
            "liveTests.discountPrice",
            "liveTests.thumbnailUrl",
            "users.displayName as teacherName",
            "users.slug as teacherSlug",
            "users.avatarUrl as teacherAvatarUrl",
            "users.tagline as teacherTagline",
            "users.yearsOfExperience as teacherYearsOfExperience",
            "users.isVerified as teacherIsVerified",
          ])
          .where("liveTests.isActive", "=", true)
          .where("liveTests.endTime", ">", new Date())
          .where("liveTests.teacherId", "in", teacherIds)
          .orderBy("liveTests.createdAt", "desc")
          .limit(CATALOGUE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("digitalProducts")
          .innerJoin("users", "users.id", "digitalProducts.teacherId")
          .select([
            "digitalProducts.id",
            "digitalProducts.slug",
            "digitalProducts.title",
            "digitalProducts.examName",
            "digitalProducts.price",
            "digitalProducts.pageCount",
            "digitalProducts.rating",
            "digitalProducts.thumbnailUrl",
            "users.displayName as teacherName",
            "users.slug as teacherSlug",
            "users.avatarUrl as teacherAvatarUrl",
            "users.tagline as teacherTagline",
            "users.yearsOfExperience as teacherYearsOfExperience",
            "users.isVerified as teacherIsVerified",
          ])
          .where("digitalProducts.status", "=", "published")
          .where("digitalProducts.teacherId", "in", teacherIds)
          .orderBy("digitalProducts.createdAt", "desc")
          .limit(CATALOGUE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("courseBundles")
          .innerJoin("users", "users.id", "courseBundles.teacherId")
          .select([
            "courseBundles.id",
            "courseBundles.slug",
            "courseBundles.title",
            "courseBundles.price",
            "courseBundles.originalPrice",
            "courseBundles.thumbnailUrl",
            "users.displayName as teacherName",
            "users.slug as teacherSlug",
            "users.avatarUrl as teacherAvatarUrl",
            "users.tagline as teacherTagline",
            "users.yearsOfExperience as teacherYearsOfExperience",
            "users.isVerified as teacherIsVerified",
          ])
          .where("courseBundles.isPublished", "=", true)
          .where("courseBundles.teacherId", "in", teacherIds)
          .orderBy("courseBundles.createdAt", "desc")
          .limit(CATALOGUE_LIMIT_PER_KIND)
          .execute(),
      ]);

      for (const c of courses) {
        catalogue.push({
          kind: "course",
          id: c.id,
          slug: c.slug,
          title: c.title,
          examName: c.examName,
          price: Number(c.price),
          discountPrice: courseDiscountPrice(c.price, c.discountPrice),
          thumbnailUrl: c.thumbnailImageUrl,
          pageCount: null,
          rating: c.rating !== null ? Number(c.rating) : null,
          teacherName: c.teacherName,
          teacherSlug: c.teacherSlug,
          teacherAvatarUrl: c.teacherAvatarUrl,
          teacherTagline: c.teacherTagline,
          teacherYearsOfExperience: c.teacherYearsOfExperience,
          teacherIsVerified: !!c.teacherIsVerified,
        });
      }
      for (const t of tests) {
        catalogue.push({
          kind: "test",
          id: t.id,
          slug: t.slug,
          title: t.title,
          examName: t.examName,
          price: Number(t.price),
          discountPrice: courseDiscountPrice(t.price, t.discountPrice),
          thumbnailUrl: t.thumbnailUrl,
          pageCount: null,
          rating: t.rating !== null ? Number(t.rating) : null,
          teacherName: t.teacherName,
          teacherSlug: t.teacherSlug,
          teacherAvatarUrl: t.teacherAvatarUrl,
          teacherTagline: t.teacherTagline,
          teacherYearsOfExperience: t.teacherYearsOfExperience,
          teacherIsVerified: !!t.teacherIsVerified,
        });
      }
      for (const lt of liveTests) {
        catalogue.push({
          kind: "live_test",
          id: lt.id,
          slug: String(lt.id),
          title: lt.title,
          examName: null,
          price: Number(lt.price),
          discountPrice: courseDiscountPrice(lt.price, lt.discountPrice),
          thumbnailUrl: lt.thumbnailUrl,
          pageCount: null,
          rating: null,
          teacherName: lt.teacherName,
          teacherSlug: lt.teacherSlug,
          teacherAvatarUrl: lt.teacherAvatarUrl,
          teacherTagline: lt.teacherTagline,
          teacherYearsOfExperience: lt.teacherYearsOfExperience,
          teacherIsVerified: !!lt.teacherIsVerified,
        });
      }
      for (const p of products) {
        catalogue.push({
          kind: "product",
          id: p.id,
          slug: p.slug,
          title: p.title,
          examName: p.examName,
          price: Number(p.price),
          discountPrice: null,
          thumbnailUrl: p.thumbnailUrl,
          pageCount: p.pageCount,
          rating: p.rating !== null ? Number(p.rating) : null,
          teacherName: p.teacherName,
          teacherSlug: p.teacherSlug,
          teacherAvatarUrl: p.teacherAvatarUrl,
          teacherTagline: p.teacherTagline,
          teacherYearsOfExperience: p.teacherYearsOfExperience,
          teacherIsVerified: !!p.teacherIsVerified,
        });
      }
      for (const b of bundles) {
        catalogue.push({
          kind: "bundle",
          id: b.id,
          slug: b.slug,
          title: b.title,
          examName: null,
          price: Math.max(Number(b.price), Number(b.originalPrice) || 0),
          discountPrice: Number(b.originalPrice) > Number(b.price) ? Number(b.price) : null,
          thumbnailUrl: b.thumbnailUrl,
          pageCount: null,
          rating: null,
          teacherName: b.teacherName,
          teacherSlug: b.teacherSlug,
          teacherAvatarUrl: b.teacherAvatarUrl,
          teacherTagline: b.teacherTagline,
          teacherYearsOfExperience: b.teacherYearsOfExperience,
          teacherIsVerified: !!b.teacherIsVerified,
        });
      }
    }

    let posts: OrganizationPost[] = [];
    if (teacherIds.length > 0) {
      const postRows = await db
        .selectFrom("teacherPosts")
        .innerJoin("users", "users.id", "teacherPosts.teacherId")
        .select((eb) => [
          "teacherPosts.id",
          "teacherPosts.body",
          "teacherPosts.imageUrl",
          "teacherPosts.createdAt",
          "users.displayName as teacherName",
          "users.slug as teacherSlug",
          "users.avatarUrl as teacherAvatarUrl",
          eb
            .selectFrom("teacherPostLikes")
            .select((eb2) => eb2.fn.countAll<number>().as("count"))
            .whereRef("teacherPostLikes.postId", "=", "teacherPosts.id")
            .as("likeCount"),
          userId !== null
            ? eb
                .selectFrom("teacherPostLikes")
                .select(["id"])
                .whereRef("teacherPostLikes.postId", "=", "teacherPosts.id")
                .where("teacherPostLikes.studentId", "=", userId)
                .as("myLikeId")
            : eb.val<number | null>(null).as("myLikeId"),
        ])
        .where("teacherPosts.teacherId", "in", teacherIds)
        .orderBy("teacherPosts.createdAt", "desc")
        .limit(POSTS_LIMIT)
        .execute();

      posts = postRows.map((row) => ({
        id: row.id,
        body: row.body,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt,
        likeCount: Number(row.likeCount ?? 0),
        likedByMe: !!row.myLikeId,
        teacherName: row.teacherName,
        teacherSlug: row.teacherSlug,
        teacherAvatarUrl: row.teacherAvatarUrl,
      }));
    }

    const galleryRows = await db
      .selectFrom("organizationGalleryItems")
      .select(["id", "mediaType", "url", "fileId", "caption", "createdAt"])
      .where("organizationId", "=", org.id)
      .orderBy("orderIndex", "asc")
      .orderBy("createdAt", "asc")
      .execute();

    const gallery = galleryRows.map((g) => ({
      id: g.id,
      mediaType: g.mediaType as "photo" | "video",
      url: g.url,
      fileId: g.fileId,
      caption: g.caption,
      createdAt: g.createdAt,
    }));

    const [followerCountRow, followingRow, reviewStatsRow] = await Promise.all([
      db
        .selectFrom("organizationFollows")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("organizationId", "=", org.id)
        .executeTakeFirst(),
      userId !== null
        ? db
            .selectFrom("organizationFollows")
            .select(["id"])
            .where("organizationId", "=", org.id)
            .where("studentId", "=", userId)
            .executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("organizationReviews")
        .select((eb) => [
          eb.fn.countAll<number>().as("count"),
          eb.fn.avg<number | null>("rating").as("avgRating"),
        ])
        .where("organizationId", "=", org.id)
        .executeTakeFirst(),
    ]);

    const response: OutputType = {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        orgType: org.orgType,
        description: org.description,
        logoUrl: org.logoUrl,
        coverImageUrl: org.coverImageUrl,
        location: org.location,
        websiteUrl: org.websiteUrl,
        phoneNumber: org.phoneNumber,
        createdAt: org.createdAt,
        foundedYear: org.foundedYear,
        instituteSize: (org.instituteSize as OutputType["organization"]["instituteSize"]) ?? null,
        specialties: Array.isArray(org.specialties) ? (org.specialties as string[]) : [],
        socialLinks: (org.socialLinks as OutputType["organization"]["socialLinks"]) ?? null,
      },
      teachers,
      catalogue,
      posts,
      gallery,
      followerCount: Number(followerCountRow?.count ?? 0),
      isFollowing: !!followingRow,
      reviewCount: Number(reviewStatsRow?.count ?? 0),
      averageRating: reviewStatsRow?.avgRating != null ? Number(reviewStatsRow.avgRating) : null,
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to fetch organization profile:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to load organisation.", details: errorMessage }),
      { status: 500 }
    );
  }
}
