import superjson from "superjson";
import { getServerUserSession } from "./getServerUserSession";

export const analyticsJson = (body: unknown, status = 200): Response =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Analytics is for the academy owner only: team managers run the catalogue but
 * never see the owner's money, so they get a 403 rather than a zeroed copy.
 * An admin impersonating a teacher keeps working through effectiveTeacherId.
 */
export async function resolveAnalyticsTeacher(
  request: Request
): Promise<{ teacherId: number; denied?: undefined } | { teacherId?: undefined; denied: Response }> {
  const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
  if (user.role !== "teacher" && user.role !== "admin") {
    return { denied: analyticsJson({ error: "Unauthorized" }, 403) };
  }
  if (teacherRole === "manager") {
    return { denied: analyticsJson({ error: "Analytics is only available to the academy owner." }, 403) };
  }
  return { teacherId: effectiveTeacherId };
}

export function analyticsErrorResponse(label: string, error: unknown): Response {
  console.error(`Error building teacher analytics ${label}:`, error);
  if (error instanceof Error && error.name === "NotAuthenticatedError") {
    return analyticsJson({ error: "Not authenticated" }, 401);
  }
  if (error instanceof Error && error.name === "ZodError") {
    return analyticsJson({ error: "Invalid request" }, 400);
  }
  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return analyticsJson({ error: message }, 500);
}