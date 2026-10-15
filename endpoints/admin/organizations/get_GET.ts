import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { courseDiscountPrice } from "../../../helpers/coursePricing";
import { ForbiddenError, getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { schema, type AdminOrganizationResource, type OutputType } from "./get_GET.schema";

const RESOURCE_LIMIT_PER_KIND = 50;
const LATEST_LIMIT = 25;

const errorResponse = (error: unknown) => {
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 500;
  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return new Response(superjson.stringify({ error: message }), { status });
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

const asLinkRecord = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const parsed = schema.safeParse({ id: new URL(request.url).searchParams.get("id") });
    if (!parsed.success) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    const org = await db
      .selectFrom("organizations")
      .selectAll()
      .where("id", "=", parsed.data.id)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    const [owner, memberRows] = await Promise.all([
      db
        .selectFrom("users")
        .select(["id", "displayName", "email", "mobileNumber", "slug", "isActive"])
        .where("id", "=", org.createdByTeacherId)
        .executeTakeFirst(),
      db
        .selectFrom("organizationTeachers")
        .innerJoin("users", "users.id", "organizationTeachers.teacherId")
        .select([
          "organizationTeachers.id as membershipId",
          "organizationTeachers.teacherId",
          "organizationTeachers.status",
          "organizationTeachers.requestedAt",
          "organizationTeachers.respondedAt",
          "users.displayName",
          "users.email",
          "users.slug",
          "users.avatarUrl",
          "users.isVerified",
        ])
        .where("organizationTeachers.organizationId", "=", org.id)
        .orderBy("organizationTeachers.requestedAt", "asc")
        .execute(),
    ]);

    const approvedIds = memberRows.filter((m) => m.status === "approved").map((m) => m.teacherId);

    let resources: AdminOrganizationResource[] = [];
    if (approvedIds.length > 0) {
      const [courses, bundles, tests, liveTests, products] = await Promise.all([
        db
          .selectFrom("courses")
          .innerJoin("users", "users.id", "courses.teacherId")
          .select(["courses.id", "courses.title", "courses.slug", "courses.price", "courses.discountPrice", "courses.createdAt", "users.displayName as teacherName"])
          .where("courses.status", "=", "published")
          .where("courses.teacherId", "in", approvedIds)
          .orderBy("courses.createdAt", "desc")
          .limit(RESOURCE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("courseBundles")
          .innerJoin("users", "users.id", "courseBundles.teacherId")
          .select(["courseBundles.id", "courseBundles.title", "courseBundles.slug", "courseBundles.price", "courseBundles.originalPrice", "courseBundles.createdAt", "users.displayName as teacherName"])
          .where("courseBundles.isPublished", "=", true)
          .where("courseBundles.teacherId", "in", approvedIds)
          .orderBy("courseBundles.createdAt", "desc")
          .limit(RESOURCE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("mockTests")
          .innerJoin("users", "users.id", "mockTests.teacherId")
          .select(["mockTests.id", "mockTests.title", "mockTests.slug", "mockTests.price", "mockTests.discountPrice", "mockTests.createdAt", "users.displayName as teacherName"])
          .where("mockTests.isPublished", "=", true)
          .where("mockTests.deletedAt", "is", null)
          .where("mockTests.teacherId", "in", approvedIds)
          .orderBy("mockTests.createdAt", "desc")
          .limit(RESOURCE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("liveTests")
          .innerJoin("users", "users.id", "liveTests.teacherId")
          .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
          .select(["liveTests.id", "mockTests.slug", "liveTests.title", "liveTests.price", "liveTests.discountPrice", "liveTests.createdAt", "users.displayName as teacherName"])
          .where("liveTests.isActive", "=", true)
          .where("liveTests.endTime", ">", new Date())
          .where("liveTests.teacherId", "in", approvedIds)
          .orderBy("liveTests.createdAt", "desc")
          .limit(RESOURCE_LIMIT_PER_KIND)
          .execute(),
        db
          .selectFrom("digitalProducts")
          .innerJoin("users", "users.id", "digitalProducts.teacherId")
          .select(["digitalProducts.id", "digitalProducts.title", "digitalProducts.slug", "digitalProducts.price", "digitalProducts.createdAt", "users.displayName as teacherName"])
          .where("digitalProducts.status", "=", "published")
          .where("digitalProducts.teacherId", "in", approvedIds)
          .orderBy("digitalProducts.createdAt", "desc")
          .limit(RESOURCE_LIMIT_PER_KIND)
          .execute(),
      ]);

      resources = [
        ...courses.map((c) => ({
          kind: "course" as const,
          id: c.id,
          title: c.title,
          slug: c.slug,
          price: Number(c.price),
          discountPrice: courseDiscountPrice(c.price, c.discountPrice),
          teacherName: c.teacherName,
          createdAt: c.createdAt,
        })),
        ...bundles.map((b) => ({
          kind: "bundle" as const,
          id: b.id,
          title: b.title,
          slug: b.slug,
          price: Math.max(Number(b.price), Number(b.originalPrice) || 0),
          discountPrice: Number(b.originalPrice) > Number(b.price) ? Number(b.price) : null,
          teacherName: b.teacherName,
          createdAt: b.createdAt,
        })),
        ...tests.map((t) => ({
          kind: "test" as const,
          id: t.id,
          title: t.title,
          slug: t.slug,
          price: Number(t.price),
          discountPrice: courseDiscountPrice(t.price, t.discountPrice),
          teacherName: t.teacherName,
          createdAt: t.createdAt,
        })),
        ...liveTests.map((l) => ({
          kind: "live_test" as const,
          id: l.id,
          title: l.title,
          slug: l.slug,
          price: Number(l.price),
          discountPrice: courseDiscountPrice(l.price, l.discountPrice),
          teacherName: l.teacherName,
          createdAt: l.createdAt,
        })),
        ...products.map((p) => ({
          kind: "product" as const,
          id: p.id,
          title: p.title,
          slug: p.slug,
          price: Number(p.price),
          discountPrice: null,
          teacherName: p.teacherName,
          createdAt: p.createdAt,
        })),
      ];
    }

    const [reviewStats, distributionRows, latestReviews, postRows, galleryRows, followersRow] = await Promise.all([
      db
        .selectFrom("organizationReviews")
        .select((eb) => [eb.fn.countAll<string>().as("count"), eb.fn.avg<string | null>("rating").as("avg")])
        .where("organizationId", "=", org.id)
        .executeTakeFirst(),
      db
        .selectFrom("organizationReviews")
        .select((eb) => ["rating", eb.fn.countAll<string>().as("count")])
        .where("organizationId", "=", org.id)
        .groupBy("rating")
        .execute(),
      db
        .selectFrom("organizationReviews")
        .select(["id", "rating", "reviewText", "createdAt"])
        .where("organizationId", "=", org.id)
        .orderBy("createdAt", "desc")
        .limit(LATEST_LIMIT)
        .execute(),
      approvedIds.length > 0
        ? db
            .selectFrom("teacherPosts")
            .innerJoin("users", "users.id", "teacherPosts.teacherId")
            .select([
              "teacherPosts.id",
              "teacherPosts.body",
              "teacherPosts.imageUrl",
              "teacherPosts.createdAt",
              "users.displayName as teacherName",
              sql<string>`(SELECT COUNT(*) FROM teacher_post_likes l WHERE l.post_id = teacher_posts.id)`.as("likeCount"),
            ])
            .where("teacherPosts.teacherId", "in", approvedIds)
            .orderBy("teacherPosts.createdAt", "desc")
            .limit(LATEST_LIMIT)
            .execute()
        : Promise.resolve([]),
      db
        .selectFrom("organizationGalleryItems")
        .select(["id", "mediaType", "url", "caption"])
        .where("organizationId", "=", org.id)
        .orderBy("orderIndex", "asc")
        .orderBy("createdAt", "asc")
        .execute(),
      db
        .selectFrom("organizationFollows")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("organizationId", "=", org.id)
        .executeTakeFirst(),
    ]);

    const countByStars = new Map(distributionRows.map((row) => [Number(row.rating), Number(row.count)]));

    const output: OutputType = {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        orgType: org.orgType,
        description: org.description,
        logoUrl: org.logoUrl,
        coverImageUrl: org.coverImageUrl,
        location: org.location,
        phoneNumber: org.phoneNumber,
        websiteUrl: org.websiteUrl,
        foundedYear: org.foundedYear,
        instituteSize: org.instituteSize,
        specialties: asStringArray(org.specialties),
        socialLinks: asLinkRecord(org.socialLinks),
        isActive: org.isActive,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
      owner: {
        id: org.createdByTeacherId,
        name: owner?.displayName ?? "Deleted teacher",
        email: owner?.email ?? null,
        mobileNumber: owner?.mobileNumber ?? null,
        slug: owner?.slug ?? null,
        isActive: !!owner?.isActive,
      },
      members: memberRows.map((m) => ({
        membershipId: m.membershipId,
        teacherId: m.teacherId,
        name: m.displayName,
        email: m.email,
        slug: m.slug,
        avatarUrl: m.avatarUrl,
        isVerified: !!m.isVerified,
        isOwner: m.teacherId === org.createdByTeacherId,
        status: m.status,
        requestedAt: m.requestedAt,
        respondedAt: m.respondedAt,
      })),
      resources,
      reviews: {
        count: Number(reviewStats?.count ?? 0),
        averageRating: reviewStats?.avg != null ? Number(reviewStats.avg) : null,
        distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: countByStars.get(stars) ?? 0 })),
        latest: latestReviews,
      },
      posts: postRows.map((p) => ({
        id: p.id,
        body: p.body,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
        teacherName: p.teacherName,
        likeCount: Number(p.likeCount ?? 0),
      })),
      gallery: galleryRows.map((g) => ({
        id: g.id,
        mediaType: g.mediaType as "photo" | "video",
        url: g.url,
        caption: g.caption,
      })),
      followersCount: Number(followersRow?.count ?? 0),
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error fetching admin organization:", error);
    return errorResponse(error);
  }
}