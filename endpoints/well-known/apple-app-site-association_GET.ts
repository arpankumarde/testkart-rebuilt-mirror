import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const file = await db
      .selectFrom("wellKnownFiles")
      .where("fileKey", "=", "apple-app-site-association")
      .selectAll()
      .executeTakeFirst();

    // Default to empty object if not found per requirements
    const content = file?.content ? file.content : "{}";
    
    return new Response(content, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}