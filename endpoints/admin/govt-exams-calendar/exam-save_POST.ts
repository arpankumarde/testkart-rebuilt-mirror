import superjson from "superjson";
import type { InputType, OutputType } from "./exam-save_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = superjson.parse<InputType>(await request.text());
    const result: OutputType = { exam: await gecServer.saveExam(input, admin.id) };
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error saving calendar record");
  }
}