import superjson from "superjson";
import { searchTeachers } from "../../../helpers/searchTeachers";
import { OutputType, schema } from "./teachers_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const validation = schema.safeParse(Object.fromEntries(url.searchParams.entries()));

    if (!validation.success) {
      return new Response(
        superjson.stringify({
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        }),
        { status: 400 }
      );
    }

    const output: OutputType = await searchTeachers(validation.data);

    return new Response(superjson.stringify(output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error during teacher search:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to search teachers",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}