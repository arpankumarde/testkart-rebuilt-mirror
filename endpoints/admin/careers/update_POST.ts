import { OutputType, schema } from "./update_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existingCareer = await db
      .selectFrom("careerPostings")
      .select("id")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!existingCareer) {
      return new Response(
        superjson.stringify({ error: "Career posting not found" }),
        { status: 404 }
      );
    }

    const updates: Record<string, any> = {};

    if (input.title !== undefined) {
      updates.title = input.title;
      // Regenerate slug
      let baseSlug = slugify(input.title);
      let finalSlug = baseSlug;
      let collisionCounter = 2;

      while (true) {
        const slugCollision = await db
          .selectFrom("careerPostings")
          .select("id")
          .where("slug", "=", finalSlug)
          .where("id", "!=", input.id)
          .executeTakeFirst();

        if (!slugCollision) {
          break;
        }
        finalSlug = `${baseSlug}-${collisionCounter}`;
        collisionCounter++;
      }
      updates.slug = finalSlug;
    }

    if (input.department !== undefined) updates.department = input.department;
    if (input.location !== undefined) updates.location = input.location;
    if (input.employmentType !== undefined) updates.employmentType = input.employmentType;
    if (input.experienceLevel !== undefined) updates.experienceLevel = input.experienceLevel;
    if (input.description !== undefined) updates.description = input.description;
    if (input.requirements !== undefined) updates.requirements = input.requirements;
    if (input.salaryRange !== undefined) updates.salaryRange = input.salaryRange;
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    if (input.orderIndex !== undefined) updates.orderIndex = input.orderIndex;

    await db
      .updateTable("careerPostings")
      .set(updates)
      .where("id", "=", input.id)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        message: "Career posting updated successfully",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error updating career posting:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}