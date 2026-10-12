import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can create an organisation page." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const baseSlug = slugify(input.name) || "organisation";

    const organization = await db.transaction().execute(async (trx) => {
      // Uniquify the slug the same way teacher/course slugs do elsewhere -
      // try the bare slug, then append -2, -3, ... until free.
      let slug = baseSlug;
      let suffix = 1;
      for (;;) {
        const existing = await trx
          .selectFrom("organizations")
          .select(["id"])
          .where("slug", "=", slug)
          .executeTakeFirst();
        if (!existing) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const org = await trx
        .insertInto("organizations")
        .values({
          name: input.name,
          slug,
          orgType: input.orgType,
          description: input.description || null,
          location: input.location || null,
          websiteUrl: input.websiteUrl || null,
          createdByTeacherId: effectiveTeacherId,
        })
        .returning(["id", "name", "slug", "orgType"])
        .executeTakeFirstOrThrow();

      // The creator is the first associated teacher, pre-approved.
      await trx
        .insertInto("organizationTeachers")
        .values({
          organizationId: org.id,
          teacherId: effectiveTeacherId,
          status: "approved",
          respondedAt: new Date(),
          respondedByTeacherId: effectiveTeacherId,
        })
        .execute();

      return org;
    });

    return new Response(
      superjson.stringify({ organization } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to create organization:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to create organisation page.", details: errorMessage }),
      { status: 500 }
    );
  }
}
