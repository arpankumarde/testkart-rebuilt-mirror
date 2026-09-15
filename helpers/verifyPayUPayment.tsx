import { lookupPayUTransactions } from "./lookupPayUTransactions";
import { extractPayUFailure, PaymentFailureColumns } from "./extractPayUFailure";

export type VerifyPaymentResult = {
  success: boolean;
  status: string; // "success", "failure", "pending", or an error status
  amount?: string;
  productinfo?: string;
  firstname?: string;
  email?: string;
  error?: string;
  // PayU's reason fields, mapped to the orders columns. Present whenever PayU returned the transaction.
  failure?: PaymentFailureColumns;
};

/**
 * Calls the PayU Verify Payment API to check the status of a transaction.
 * This is a server-side helper and requires PayU environment variables to be set.
 * @param txnid The transaction ID to verify.
 * @returns A promise that resolves to the verification result.
 */
export async function verifyPayUPayment(
  txnid: string
): Promise<VerifyPaymentResult> {
  const lookup = await lookupPayUTransactions([txnid]);

  if (!lookup.ok) {
    return { success: false, status: lookup.status, error: lookup.error };
  }

  const details = lookup.transactions[txnid];
  if (!details) {
    console.warn(`[verifyPayUPayment] PayU has no record of txnid ${txnid}: ${lookup.message}`);
    return {
      success: false,
      status: "not_found",
      error: lookup.message || `Transaction details not found in PayU response for txnid ${txnid}`,
    };
  }

  console.log(`[verifyPayUPayment] Successfully verified txnid ${txnid}. Status: ${details.status}`);

  return {
    success: true,
    status: details.status, // "success", "failure", "pending"
    amount: details.amt,
    productinfo: details.productinfo,
    firstname: details.firstname,
    email: details.email,
    failure: extractPayUFailure(details),
  };
}
