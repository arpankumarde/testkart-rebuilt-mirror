import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

async function verifySectionOwnership(sectionId: number, userId: number, userRole: string) {
  if (userRole === "admin") return true;

  const section = await db
    .selectFrom("subjectSections")
    .innerJoin("testItemSubjects", "subjectSections.subjectId", "testItemSubjects.id")
    .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
    .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
    .select("mockTests.teacherId")
    .where("subjectSections.id", "=", sectionId)
    .executeTakeFirst();

  if (!section) {
    throw new Error("Section not found");
  }

  if (section.teacherId !== userId) {
    throw new Error("You do not have permission to modify this section.");
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
    const { id, ...updateData } = schema.parse(json);

    await verifySectionOwnership(id, effectiveTeacherId, user.role);

    if (Object.keys(updateData).length === 0) {
      return new Response(
        superjson.stringify({ error: "No update data provided" }),
        { status: 400 }
      );
    }

    const updatedSection = await db
      .updateTable("subjectSections")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(updatedSection satisfies OutputType));
  } catch (error) {
    console.error("Error updating subject section:", error);
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
        status: 403,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}