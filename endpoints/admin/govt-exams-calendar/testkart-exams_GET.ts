import superjson from "superjson";
import { schema, type OutputType } from "./testkart-exams_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ q: new URL(request.url).searchParams.get("q") ?? "" });
    const result: OutputType = { exams: await gecServer.searchTestkartExams(input.q) };
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error searching Testkart exams");
  }
}