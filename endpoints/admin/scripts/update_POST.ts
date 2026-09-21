import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

        // Permission check is handled per route by getAdminServerSessionOrThrow above

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const updateData: {
      headerScript?: string | null;
      footerScript?: string | null;
      updatedAt: Date;
      updatedByAdminId: number;
    } = {
      updatedAt: new Date(),
      updatedByAdminId: admin.id,
    };

    if (validatedInput.headerScript !== undefined) {
      updateData.headerScript = validatedInput.headerScript;
    }
    if (validatedInput.footerScript !== undefined) {
      updateData.footerScript = validatedInput.footerScript;
    }

    await db
      .updateTable("platformScripts")
      .set(updateData)
      .where("id", "=", 1)
      .execute();

    const responseData: OutputType = {
      success: true,
      message: "Scripts updated successfully",
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
    console.error("Failed to update platform scripts:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}