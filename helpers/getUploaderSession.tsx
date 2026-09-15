import { AdminProfile } from "./AdminTypes";
import { User } from "./User";
import { NotAuthenticatedError as AdminNotAuthenticatedError, getAdminServerSessionOrThrow } from "./getAdminSession";
import { getServerUserSession } from "./getServerUserSession";
import { NotAuthenticatedError } from "./getSetServerSession";

export type UploaderSession =
  | { kind: "user"; user: User; ownerUserId: number }
  | { kind: "admin"; admin: AdminProfile };

/**
 * Authorizes an upload request coming from EITHER surface of the app.
 *
 * The public/teacher app authenticates with the `floot_built_app_session`
 * cookie, but the admin panel only ever sets `admin_session` — admin login
 * (endpoints/admin/login_POST.ts) never issues a user session. The upload
 * endpoints originally required the user session alone, so media uploads from
 * the admin panel (the blog/knowledge-base editor's image and video buttons,
 * careers, exam content, static pages, email templates) only worked when the
 * admin happened to also be signed in as a regular user in the same browser,
 * and returned "User not authenticated" otherwise. Logging out and back into
 * /admin never helped, because that only refreshes the admin cookie.
 *
 * The user session is tried first so nothing changes for teachers and
 * students; the admin cookie is only consulted as a fallback. Both failing
 * throws the shared NotAuthenticatedError, which every upload endpoint already
 * maps to a 401.
 *
 * ownerUserId is the account uploads are recorded against: the team owner for
 * a teacher's manager, the user themselves otherwise.
 */
export async function getUploaderSession(
  request: Request
): Promise<UploaderSession> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    return { kind: "user", user, ownerUserId: effectiveTeacherId };
  } catch (error) {
    if (!(error instanceof NotAuthenticatedError)) {
      throw error;
    }
  }

  try {
    const admin = await getAdminServerSessionOrThrow(request);
    return { kind: "admin", admin };
  } catch (error) {
    // getAdminSession declares its own NotAuthenticatedError class, so
    // normalize it to the shared one the endpoints check with instanceof.
    if (error instanceof AdminNotAuthenticatedError) {
      throw new NotAuthenticatedError();
    }
    throw error;
  }
}
