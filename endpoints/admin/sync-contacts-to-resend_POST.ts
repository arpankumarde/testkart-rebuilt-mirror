import { schema } from "./sync-contacts-to-resend_POST.schema";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";
import { db } from "../../helpers/db";
import { addContactToAudience } from "../../helpers/resendContacts";

export async function handle(request: Request) {
  try {
    // 1. Require admin authentication
    await getAdminServerSessionOrThrow(request, ['super_admin']);

    // Parse input (empty object, optional - this endpoint doesn't require any body)
    const text = await request.text().catch(() => "");
    let json = {};
    if (text && text.trim()) {
      try {
        // Try superjson first (checks for .json property)
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && 'json' in parsed) {
          json = parsed.json ?? {};
        } else {
          json = parsed ?? {};
        }
      } catch {
        // If JSON parse fails, just use empty object
        json = {};
      }
    }
    schema.parse(json);

    // 2. Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Query all active users with emails (students and teachers only)
          const users = await db
            .selectFrom("users")
            .select(["id", "email", "displayName", "role"])
            .where("isActive", "=", true)
            .where("email", "is not", null)
            .where("role", "in", ["student", "teacher"])
            .execute();

          const total = users.length;
          let synced = 0;
          let failed = 0;
          const errors: string[] = [];

          console.log(`Starting sync for ${total} users...`);

          // 3. Process contacts sequentially to respect Resend's 2 req/sec limit
          // Using 600ms delay = ~1.6 req/sec to be safe
          const DELAY_MS = 600;

          for (let i = 0; i < users.length; i++) {
            const user = users[i];

            if (!user.email) {
              failed++;
              errors.push(`User ${user.id}: No email address`);
              continue;
            }

            const firstName = user.displayName.split(" ")[0] || "User";
            const role = user.role as "student" | "teacher";

            // Removed verbose logging

            let retryCount = 0;
            let success = false;

            // Retry logic for rate limiting
            while (retryCount < 2 && !success) {
              try {
                const result = await addContactToAudience(
                  user.email,
                  firstName,
                  role,
                  user.id
                );

                if (!result.success) {
                  // Format error message properly
                  const errorMessage =
                    typeof result.error === "object"
                      ? JSON.stringify(result.error)
                      : String(result.error);
                  
                  // Log first few errors to help debug
                  if (failed < 3) {
                    console.log(`SYNC ERROR for ${user.email}:`, errorMessage);
                  }

                  // Check if rate limited
                  if (
                    errorMessage.includes("rate limit") ||
                    errorMessage.includes("429")
                  ) {
                    console.log(`Rate limited for ${user.email}, waiting 1s...`);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    retryCount++;
                    continue;
                  }

                  if (i < 3) {
                  console.error(`Failed for ${user.email}:`, errorMessage);
                }
                  errors.push(`${user.email}: ${errorMessage}`);
                  failed++;
                  success = true; // Don't retry for non-rate-limit errors
                } else {
                  synced++;
                  success = true;
                }
              } catch (err) {
                const errorMessage =
                  err instanceof Error ? err.message : JSON.stringify(err);

                // Check if rate limited
                if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
                  console.log(`Rate limited for ${user.email}, waiting 1s...`);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  retryCount++;
                  continue;
                }

                console.error(`Exception for ${user.email}:`, errorMessage);
                errors.push(`${user.email}: ${errorMessage}`);
                failed++;
                success = true; // Don't retry for non-rate-limit errors
              }
            }

            // If still not successful after retries, count as failed
            if (!success) {
              console.error(`Failed after retries for ${user.email}`);
              errors.push(`${user.email}: Failed after retries`);
              failed++;
            }

            // Send progress update every 5 users to keep connection alive
            if ((i + 1) % 5 === 0 || i === users.length - 1) {
              const progressUpdate = JSON.stringify({
                progress: true,
                current: i + 1,
                total,
                synced,
                failed,
              });
              controller.enqueue(encoder.encode(progressUpdate + "\n"));
              console.log(`Progress: ${i + 1}/${total}. Synced: ${synced}, Failed: ${failed}`);
            }

            // Add delay between requests (skip for last user)
            if (i < users.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
            }
          }

          console.log(`Sync complete. Total: ${total}, Synced: ${synced}, Failed: ${failed}`);

          // Send final summary
          const finalSummary = JSON.stringify({
            complete: true,
            synced,
            failed,
            total,
            errors: errors.slice(0, 100), // Limit error log size in response
          });
          controller.enqueue(encoder.encode(finalSummary + "\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          const errorResponse = JSON.stringify({
            complete: true,
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(errorResponse + "\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Sync contacts error:", error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}