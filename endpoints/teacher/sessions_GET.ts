import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { summariseOtherSignIns } from "../../helpers/teacherSignIns";
import { OutputType } from "./sessions_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, session } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can see their sign-ins here." }), {
        status: 403,
      });
    }

    const output: OutputType = await summariseOtherSignIns(user.id, session.id);
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error summarising teacher sign-ins:", error);
    return new Response(superjson.stringify({ error: "Your sign-ins could not be loaded." }), { status: 500 });
  }
}