import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./join-request_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can join an organisation." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", input.organizationId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    const existing = await db
      .selectFrom("organizationTeachers")
      .select(["id", "status"])
      .where("organizationId", "=", input.organizationId)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (existing?.status === "approved") {
      return new Response(
        superjson.stringify({ error: "You're already associated with this organisation." }),
        { status: 400 }
      );
    }
    if (existing?.status === "pending") {
      return new Response(
        superjson.stringify({ error: "Your request is already pending approval." }),
        { status: 400 }
      );
    }

    if (existing) {
      // Previously rejected - a fresh request is allowed.
      await db
        .updateTable("organizationTeachers")
        .set({ status: "pending", requestedAt: new Date(), respondedAt: null, respondedByTeacherId: null })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("organizationTeachers")
        .values({ organizationId: input.organizationId, teacherId: effectiveTeacherId, status: "pending" })
        .execute();
    }

    return new Response(superjson.stringify({ status: "pending" } satisfies OutputType));
  } catch (error) {
    console.error("Failed to request to join organization:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to send request.", details: errorMessage }),
      { status: 500 }
    );
  }
}
