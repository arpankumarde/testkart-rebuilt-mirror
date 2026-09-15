 import { db } from "../../helpers/db";
 import { schema, OutputType } from "./submit_POST.schema";
import { sendTemplateEmail, ADMIN_EMAIL } from "../../helpers/sendTemplateEmail";
 import superjson from "superjson";
 import { ZodError } from "zod";
 
export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const result = await db
      .insertInto("contactSubmissions")
      .values({
        name: validatedInput.name,
        email: validatedInput.email,
        subject: validatedInput.subject,
        message: validatedInput.message,
        status: "new",
        createdAt: new Date(),
      })
       .returning("id")
       .executeTakeFirstOrThrow();
 
        await Promise.all([
      sendTemplateEmail("contact_form_acknowledgment", validatedInput.email, {
        name: validatedInput.name,
        messagePreview: validatedInput.message.substring(0, 100),
      }).catch(err => console.error("Failed to send contact acknowledgment email:", err)),
      sendTemplateEmail("contact_form_admin_alert", ADMIN_EMAIL, {
        name: validatedInput.name,
        email: validatedInput.email,
        phone: "",
        message: validatedInput.message,
      }).catch(err => console.error("Failed to send admin alert email:", err)),
    ]);

     return new Response(
       superjson.stringify({
         success: true,
        submissionId: result.id,
      } satisfies OutputType),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Failed to submit contact form:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid input provided", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}