import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./follow_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can follow organisation pages." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id"])
      .where("id", "=", input.organizationId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!org) {
      return new Response(
        superjson.stringify({ error: "Organisation not found." }),
        { status: 404 }
      );
    }

    const existing = await db
      .selectFrom("organizationFollows")
      .select(["id"])
      .where("organizationId", "=", input.organizationId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (existing) {
      await db
        .deleteFrom("organizationFollows")
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("organizationFollows")
        .values({ organizationId: input.organizationId, studentId: user.id })
        .execute();
    }

    const countRow = await db
      .selectFrom("organizationFollows")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("organizationId", "=", input.organizationId)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        isFollowing: !existing,
        followerCount: Number(countRow?.count ?? 0),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to toggle organisation follow:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update follow status.", details: errorMessage }),
      { status: 500 }
    );
  }
}
