import { db } from "./db";
import type { BillingDetails } from "../endpoints/account/billing-details_GET.schema";
import { isIndianState } from "./indianLocationsData";

/**
 * Reads users.billing_details tolerantly: rows are jsonb objects today, but
 * jsonb columns in this project have held JSON-encoded strings before. A
 * stored state that is not one of INDIAN_STATES is read back as null.
 */
export async function readStoredBillingDetails(userId: number): Promise<BillingDetails | null> {
  const row = await db
    .selectFrom("users")
    .select(["billingDetails"])
    .where("id", "=", userId)
    .executeTakeFirst();

  let raw: unknown = row?.billingDetails ?? null;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : "");
  return {
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    state: isIndianState(value.state) ? value.state : null,
    country: isIndianState(value.state) ? "India" : null,
    gstin: text("gstin") || null,
  };
}