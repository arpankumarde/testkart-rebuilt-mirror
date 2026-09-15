import { db } from "../../../helpers/db";
import { OutputType } from "./get_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const scripts = await db
      .selectFrom("platformScripts")
      .where("id", "=", 1)
      .select(["headerScript", "footerScript"])
      .executeTakeFirst();

    const responseData: OutputType = {
      headerScript: scripts?.headerScript ?? null,
      footerScript: scripts?.footerScript ?? null,
    };

        return new Response(superjson.stringify(responseData), {
       headers: {
         "Content-Type": "application/json",
         "Cache-Control": "public, max-age=3600, s-maxage=3600",
       },
    });
  } catch (error) {
     console.error("Failed to get platform scripts:", error);
     const errorMessage =
       error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}