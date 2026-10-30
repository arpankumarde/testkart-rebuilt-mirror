import superjson from "superjson";
import { schema, type OutputType } from "./testkart-pages_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ examId: Number(new URL(request.url).searchParams.get("examId")) });
    const result: OutputType = await gecServer.testkartPages(input.examId);
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error loading Testkart exam pages");
  }
}