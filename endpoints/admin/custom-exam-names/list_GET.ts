import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getCustomExamNameCounts } from "../../../helpers/customExamNameCounts";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const customNames = await getCustomExamNameCounts();

    return new Response(
      superjson.stringify({ customNames } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}
