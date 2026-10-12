import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, OrganizationSearchResult } from "./search_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can search organisations." }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({ q: url.searchParams.get("q") });

    const rows = await db
      .selectFrom("organizations")
      .select((eb) => [
        "organizations.id",
        "organizations.name",
        "organizations.slug",
        "organizations.orgType",
        "organizations.logoUrl",
        "organizations.location",
        eb
          .selectFrom("organizationTeachers as ot")
          .select((eb2) => eb2.fn.countAll<number>().as("count"))
          .whereRef("ot.organizationId", "=", "organizations.id")
          .where("ot.status", "=", "approved")
          .as("teacherCount"),
        eb
          .selectFrom("organizationTeachers as ot2")
          .select(["ot2.status"])
          .whereRef("ot2.organizationId", "=", "organizations.id")
          .where("ot2.teacherId", "=", effectiveTeacherId)
          .as("membershipStatus"),
      ])
      .where("organizations.isActive", "=", true)
      .where("organizations.name", "ilike", `%${input.q}%`)
      .orderBy("organizations.name", "asc")
      .limit(20)
      .execute();

    const results: OrganizationSearchResult[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      orgType: row.orgType,
      logoUrl: row.logoUrl,
      location: row.location,
      teacherCount: Number(row.teacherCount ?? 0),
      membershipStatus: row.membershipStatus ?? null,
    }));

    return new Response(superjson.stringify({ results } satisfies OutputType));
  } catch (error) {
    console.error("Failed to search organizations:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to search organisations.", details: errorMessage }),
      { status: 500 }
    );
  }
}
