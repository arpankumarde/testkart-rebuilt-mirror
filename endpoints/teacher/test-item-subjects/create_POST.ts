import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

async function verifyOwnership(testItemId: number, userId: number, userRole: string) {
  if (userRole === 'admin') return true;

  const testItem = await db
    .selectFrom("mockTestItems")
    .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
    .select("mockTests.teacherId")
    .where("mockTestItems.id", "=", testItemId)
    .executeTakeFirst();

  if (!testItem) {
    throw new Error("Test item not found");
  }

  if (testItem.teacherId !== userId) {
    throw new Error("You do not have permission to modify this test item.");
  }
  
  return true;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: Access denied" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await verifyOwnership(input.testItemId, effectiveTeacherId, user.role);

    const newSubject = await db
      .insertInto("testItemSubjects")
      .values({
        testItemId: input.testItemId,
        subjectName: input.subjectName,
        orderIndex: input.orderIndex,
        durationMinutes: input.durationMinutes ?? 20,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newSubject satisfies OutputType));
  } catch (error) {
    console.error("Error creating test item subject:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Authentication required" }), {
        status: 401,
      });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input", details: error.errors }), {
        status: 400,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 403, // Can be 403 for permission or 404 for not found
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}