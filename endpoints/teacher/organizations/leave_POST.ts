import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./leave_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can leave an organisation." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    if (org.createdByTeacherId === effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "The creator can't leave their own organisation page." }),
        { status: 400 }
      );
    }

    await db
      .deleteFrom("organizationTeachers")
      .where("organizationId", "=", input.organizationId)
      .where("teacherId", "=", effectiveTeacherId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Failed to leave organization:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to leave organisation.", details: errorMessage }),
      { status: 500 }
    );
  }
}
