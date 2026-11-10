import { z } from "zod";
import superjson from "superjson";
import type { LiveBookingRow } from "./bookings_GET.schema";

export const schema = z.object({
  type: z.enum(["booking", "group"]),
  id: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { booking: LiveBookingRow };

export const getAdminLiveBooking = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ type: input.type, id: input.id });
  const result = await fetch(`/_api/admin/live-lessons/booking?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};