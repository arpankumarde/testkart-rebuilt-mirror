import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./respond-request_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can respond to requests." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const membership = await db
      .selectFrom("organizationTeachers")
      .innerJoin("organizations", "organizations.id", "organizationTeachers.organizationId")
      .select(["organizationTeachers.id", "organizationTeachers.status", "organizations.createdByTeacherId"])
      .where("organizationTeachers.id", "=", input.membershipId)
      .executeTakeFirst();

    if (!membership) {
      return new Response(superjson.stringify({ error: "Request not found." }), { status: 404 });
    }

    // Only the organisation's creator approves/rejects - a simple, single
    // point of authority rather than every member having equal say.
    if (membership.createdByTeacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Only the organisation's creator can respond to requests." }),
        { status: 403 }
      );
    }

    if (membership.status !== "pending") {
      return new Response(
        superjson.stringify({ error: "This request has already been handled." }),
        { status: 400 }
      );
    }

    await db
      .updateTable("organizationTeachers")
      .set({
        status: input.approve ? "approved" : "rejected",
        respondedAt: new Date(),
        respondedByTeacherId: effectiveTeacherId,
      })
      .where("id", "=", input.membershipId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Failed to respond to organization join request:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to respond to request.", details: errorMessage }),
      { status: 500 }
    );
  }
}
