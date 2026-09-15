import { db } from "../../helpers/db";
import { schema, OutputType } from "./inquiry_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return new Response(
        superjson.stringify({ error: "Method not allowed" }),
        { status: 405 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    await db
      .insertInto("teacherInquiries")
      .values({
        name: validatedInput.name,
        email: validatedInput.email,
        phone: validatedInput.phone,
        instituteName: validatedInput.instituteName,
        message: validatedInput.message,
        status: "pending",
      })
      .execute();

    const output: OutputType = {
      success: true,
      message: "Your inquiry has been submitted successfully.",
    };

    return new Response(superjson.stringify(output), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting teacher inquiry:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}