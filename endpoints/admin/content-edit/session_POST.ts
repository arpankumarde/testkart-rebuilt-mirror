import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { hasAdminModule } from "../../../helpers/adminPermissions";
import { ADMIN_EDIT_LABELS, ADMIN_EDIT_MODULES } from "../../../helpers/adminContentEdit";
import { openAdminEditSession } from "../../../helpers/adminContentEditSession";
import { schema, OutputType } from "./session_POST.schema";

/* Opens an admin editing session for one teacher item (helpers/adminContentEditSession). */

const SESSION_MINUTES = 2 * 60;

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request): Promise<Response> {
  let admin: Awaited<ReturnType<typeof getAdminServerSessionOrThrow>>;
  try {
    admin = await getAdminServerSessionOrThrow(request);
  } catch (error) {
    const notSignedIn = error instanceof Error && error.name === "NotAuthenticatedError";
    return fail(notSignedIn ? "Not authenticated" : error instanceof Error ? error.message : "Access denied", notSignedIn ? 401 : 403);
  }

  try {
    const parsed = schema.safeParse(superjson.parse(await request.text()));
    if (!parsed.success) return fail("Invalid request");
    const { type, id } = parsed.data;

    if (!hasAdminModule(admin.permissions, [ADMIN_EDIT_MODULES[type]])) {
      return fail(`Your admin account cannot edit this ${ADMIN_EDIT_LABELS[type]}.`, 403);
    }

    const session = await openAdminEditSession(admin.id, type, id, SESSION_MINUTES);
    if (!session.ok) return fail(session.error, session.status);

    console.log(`Admin ${admin.id} opened the editor for ${type} ${id} (teacher ${session.teacher.id})`);

    const output: OutputType = {
      token: session.token,
      expiresAt: session.expiresAt,
      teacher: session.teacher,
      title: session.title,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin content edit session failed:", error);
    return fail("The editor could not be opened. Try again.", 500);
  }
}