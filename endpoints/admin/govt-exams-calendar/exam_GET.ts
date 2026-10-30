import superjson from "superjson";
import { schema, type OutputType } from "./exam_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ id: Number(new URL(request.url).searchParams.get("id")) });
    const result: OutputType = { exam: await gecServer.getExam(input.id) };
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error loading calendar record");
  }
}