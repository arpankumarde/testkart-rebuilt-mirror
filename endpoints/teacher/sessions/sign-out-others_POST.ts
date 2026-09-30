import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { signOutOtherSignIns } from "../../../helpers/teacherSignIns";
import { OutputType } from "./sign-out-others_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, session, impersonatorAdminId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can sign out other devices here." }), {
        status: 403,
      });
    }
    // An admin viewing as the teacher would otherwise sign the teacher out of their own browsers.
    if (impersonatorAdminId != null) {
      return new Response(
        superjson.stringify({ error: "Only the teacher can sign out their other devices. Ask them to do it." }),
        { status: 403 }
      );
    }

    const output: OutputType = { signedOut: await signOutOtherSignIns(user.id, session.id) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error signing out other teacher sessions:", error);
    return new Response(superjson.stringify({ error: "Other devices could not be signed out. Try again." }), {
      status: 500,
    });
  }
}