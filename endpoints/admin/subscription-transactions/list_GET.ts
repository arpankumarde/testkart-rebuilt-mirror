import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import { paymentFailureReason } from "../../../helpers/paymentFailureReason";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // 1. Admin protection
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // 2. Fetch all subscription transactions joined with users and subscription_plans
    const transactions = await db
      .selectFrom("subscriptionTransactions as st")
      .innerJoin("users as u", "u.id", "st.teacherId")
      .innerJoin("subscriptionPlans as sp", "sp.id", "st.planId")
      .select([
        "st.id",
        "st.transactionDate",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "sp.name as planName",
        "st.amount",
        "st.status",
        "st.paymentMethod",
        "st.transactionId",
        "st.invoiceNumber",
        "st.paymentErrorCode",
        "st.paymentErrorMessage",
        "st.paymentBankMessage",
        "st.paymentGatewayStatus",
      ])
      .orderBy("st.createdAt", "desc")
      .execute();

    // 3. Map to OutputType (handling Kysely Numeric cast to float)
    const responseData: OutputType = transactions.map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate,
      teacherName: t.teacherName,
      teacherEmail: t.teacherEmail,
      planName: t.planName,
      amount: parseFloat(t.amount as unknown as string),
      status: t.status,
      paymentMethod: t.paymentMethod,
      transactionId: t.transactionId,
      invoiceNumber: t.invoiceNumber,
      paymentFailure:
        t.status === "failed"
          ? paymentFailureReason.details({
              paymentErrorCode: t.paymentErrorCode,
              paymentErrorMessage: t.paymentErrorMessage,
              paymentBankMessage: t.paymentBankMessage,
              paymentGatewayStatus: t.paymentGatewayStatus,
            })
          : null,
    }));

    return new Response(superjson.stringify(responseData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch admin subscription transactions:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}