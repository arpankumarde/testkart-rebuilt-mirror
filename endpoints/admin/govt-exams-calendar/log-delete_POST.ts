import superjson from "superjson";
import { schema, type OutputType } from "./log-delete_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    await gecServer.deleteLogNote(input.id);
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return gecServer.errorResponse(error, "Error deleting update note");
  }
}