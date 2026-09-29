import superjson from "superjson";
import { OutputType } from "./relationship-manager_GET.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { getTeacherContext } from "../../helpers/getTeacherContext";
import { getTeacherRelationshipManager } from "../../helpers/relationshipManager";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ manager: null } satisfies OutputType));
    }

    const { effectiveTeacherId } = await getTeacherContext(user.id);
    const manager = await getTeacherRelationshipManager(effectiveTeacherId);

    return new Response(superjson.stringify({ manager } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load your relationship manager";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}
