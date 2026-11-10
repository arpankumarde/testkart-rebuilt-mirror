import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { bookingsSource, paymentStatusExpr, amountReceivedExpr, type BookingSqlRow } from "../../../helpers/adminLiveLessonsSql";
import { toLiveBookingRow } from "../../../helpers/adminLiveBookingRow";
import { schema, OutputType } from "./booking_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const { rows } = await sql<BookingSqlRow>`
      WITH b AS (${bookingsSource})
      SELECT b.*, ${paymentStatusExpr} AS payment_status, ${amountReceivedExpr} AS amount_received
      FROM b
      WHERE b.type = ${input.type} AND b.id = ${input.id}
    `.execute(db);
    if (!rows[0]) throw new Error("This booking was not found.");
    const output: OutputType = { booking: toLiveBookingRow(rows[0]) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live booking failed:", error);
    const message = error instanceof Error ? error.message : "Could not load this booking.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}