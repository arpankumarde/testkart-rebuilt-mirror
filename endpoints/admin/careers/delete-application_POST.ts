import { schema, OutputType } from "./delete-application_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { deleteFromR2 } from "../../../helpers/r2Client";
import {
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
  ForbiddenError,
} from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    // Look up the application to get the resume file ID
    const application = await db
      .selectFrom("careerApplications")
      .select(["id", "resumeFileId"])
      .where("id", "=", validatedInput.id)
      .executeTakeFirst();

    if (!application) {
      return new Response(
        superjson.stringify({ error: "Application not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Attempt to delete the file from R2 if it exists
    if (application.resumeFileId) {
      await deleteFromR2(application.resumeFileId);
    }

    // Delete the database record
    await db
      .deleteFrom("careerApplications")
      .where("id", "=", validatedInput.id)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        message: "Application deleted successfully",
      } satisfies OutputType),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (
      error instanceof NotAuthenticatedError ||
      error instanceof ForbiddenError
    ) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("Failed to delete application:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}