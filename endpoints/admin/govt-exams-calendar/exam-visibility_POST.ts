import superjson from "superjson";
import { schema, type OutputType } from "./exam-visibility_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    await gecServer.setHidden(input.id, input.hidden, admin.id);
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return gecServer.errorResponse(error, "Error changing record visibility");
  }
}