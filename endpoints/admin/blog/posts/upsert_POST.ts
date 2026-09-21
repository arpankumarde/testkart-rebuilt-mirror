import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { slugify } from "../../../../helpers/slugify";
import { Selectable } from "kysely";
import { BlogPosts } from "../../../../helpers/schema";

// Strip basic HTML elements to roughly isolate visible text and calculate expected reading time.
function calculateReadingTime(htmlContent: string): number {
  const plainText = htmlContent.replace(/<[^>]+>/g, "");
  const wordCount = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    const targetSlug = input.slug ? slugify(input.slug) : slugify(input.title);
    
    // Validate slug uniqueness across all posts to prevent routing collisions
    let slugQuery = db.selectFrom("blogPosts").where("slug", "=", targetSlug);
    if (input.id) {
      slugQuery = slugQuery.where("id", "!=", input.id);
    }
    const existing = await slugQuery.select("id").executeTakeFirst();
    if (existing) {
      throw new Error("Post with this slug already exists.");
    }

    const readingTime = calculateReadingTime(input.content);
    
    let post: Selectable<BlogPosts> | undefined;
    // Perform operations transactionally because of complex tag relationships scaling
    await db.transaction().execute(async (trx) => {
      let publishedAt: Date | null = null;

      // A changed author must be an active admin; an unchanged one stays even if since deactivated
      const requireActiveAdmin = async (adminId: number) => {
        const author = await trx
          .selectFrom("admins")
          .select("id")
          .where("id", "=", adminId)
          .where("isActive", "=", true)
          .executeTakeFirst();
        if (!author) {
          throw new Error("The author must be an active admin.");
        }
      };

      if (input.id) {
        const currentPost = await trx.selectFrom("blogPosts").select(["status", "publishedAt", "authorId"]).where("id", "=", input.id).executeTakeFirstOrThrow();
        if (input.status === "published" && currentPost.status !== "published" && !currentPost.publishedAt) {
          publishedAt = new Date();
        } else {
          publishedAt = currentPost.publishedAt;
        }

        const authorId = input.authorId ?? currentPost.authorId;
        if (authorId !== currentPost.authorId) {
          await requireActiveAdmin(authorId);
        }

        post = await trx
          .updateTable("blogPosts")
          .set({
            authorId,
            title: input.title,
            slug: targetSlug,
            content: input.content,
            excerpt: input.excerpt ?? null,
            type: input.type,
            categoryId: input.categoryId ?? null,
            featuredImage: input.featuredImage ?? null,
            status: input.status,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            ogImage: input.ogImage ?? null,
            isFeatured: input.isFeatured,
            readingTimeMinutes: readingTime,
            publishedAt,
            updatedAt: new Date(),
          })
          .where("id", "=", input.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        if (input.status === "published") {
          publishedAt = new Date();
        }
        const authorId = input.authorId ?? admin.id;
        if (authorId !== admin.id) {
          await requireActiveAdmin(authorId);
        }
        post = await trx
          .insertInto("blogPosts")
          .values({
            authorId,
            title: input.title,
            slug: targetSlug,
            content: input.content,
            excerpt: input.excerpt ?? null,
            type: input.type,
            categoryId: input.categoryId ?? null,
            featuredImage: input.featuredImage ?? null,
            status: input.status,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            ogImage: input.ogImage ?? null,
            isFeatured: input.isFeatured,
            readingTimeMinutes: readingTime,
            publishedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            viewCount: 0,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      const postId = post.id;

      // Sync post tag attachments efficiently by finding/creating independently, and clearing prior linkages
      const inputTags = input.tags.map(t => ({ name: t.trim(), slug: slugify(t) })).filter(t => t.slug.length > 0);
      const tagIds: number[] = [];
      
      if (inputTags.length > 0) {
        for (const tag of inputTags) {
          let existingTag = await trx.selectFrom("blogTags").select("id").where("slug", "=", tag.slug).executeTakeFirst();
          if (!existingTag) {
            existingTag = await trx.insertInto("blogTags")
              .values({ name: tag.name, slug: tag.slug, createdAt: new Date() })
              .returning("id")
              .executeTakeFirstOrThrow();
          }
          tagIds.push(existingTag.id);
        }
      }

      await trx.deleteFrom("blogPostTags").where("postId", "=", postId).execute();
      if (tagIds.length > 0) {
        await trx.insertInto("blogPostTags")
          .values(tagIds.map(tagId => ({ postId, tagId })))
          .execute();
      }
    });

    if (!post) {
      throw new Error("Failed to save post");
    }

    return new Response(superjson.stringify({ success: true, post } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}