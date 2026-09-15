import { OutputType } from "./applications_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import {
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
  ForbiddenError,
} from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const applicationsRecords = await db
      .selectFrom("careerApplications")
      .leftJoin(
        "careerPostings",
        "careerPostings.id",
        "careerApplications.careerPostingId"
      )
      .select([
        "careerApplications.id",
        "careerApplications.careerPostingId",
        "careerApplications.name",
        "careerApplications.email",
        "careerApplications.phone",
        "careerApplications.linkedinUrl",
        "careerApplications.resumeUrl",
        "careerApplications.resumeFileId",
        "careerApplications.coverLetter",
        "careerApplications.createdAt",
        "careerPostings.title as careerTitle",
      ])
      .orderBy("careerApplications.createdAt", "desc")
      .execute();

    // Map output to match OutputType exactly
    const applications = applicationsRecords.map((app) => ({
      ...app,
      createdAt:
        app.createdAt instanceof Date
          ? app.createdAt
          : new Date(app.createdAt as string),
    }));

    return new Response(
      superjson.stringify({ applications } satisfies OutputType),
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

    console.error("Failed to fetch applications:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}