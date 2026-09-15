import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./ai-provider_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request, ['super_admin']);

        // Role check is now handled by getAdminServerSessionOrThrow above

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const settingKey = "ai_provider";
    const settingValue = validatedInput.aiProvider;

    await db
      .insertInto("platformSettings")
      .values({
        settingKey,
        settingValue,
        updatedAt: new Date(),
        updatedByAdminId: admin.id,
      })
      .onConflict((oc) =>
        oc.column("settingKey").doUpdateSet({
          settingValue,
          updatedAt: new Date(),
          updatedByAdminId: admin.id,
        })
      )
      .execute();

    const responseData: OutputType = {
      success: true,
      message: "AI provider updated successfully.",
    };

    return new Response(superjson.stringify(responseData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid input", details: error.errors }),
        { status: 400 }
      );
    }
    console.error("Failed to update AI provider setting:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}