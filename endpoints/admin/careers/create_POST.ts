import { OutputType, schema } from "./create_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let baseSlug = slugify(input.title);
    let finalSlug = baseSlug;
    let collisionCounter = 2;

    while (true) {
      const existing = await db
        .selectFrom("careerPostings")
        .select("id")
        .where("slug", "=", finalSlug)
        .executeTakeFirst();

      if (!existing) {
        break;
      }
      finalSlug = `${baseSlug}-${collisionCounter}`;
      collisionCounter++;
    }

    const newCareer = await db
      .insertInto("careerPostings")
      .values({
        title: input.title,
        slug: finalSlug,
        department: input.department ?? null,
        location: input.location ?? null,
        employmentType: input.employmentType,
        experienceLevel: input.experienceLevel ?? null,
        description: input.description,
        requirements: input.requirements ?? null,
        salaryRange: input.salaryRange ?? null,
        isActive: input.isActive,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        success: true,
        career: newCareer,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error creating career posting:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}