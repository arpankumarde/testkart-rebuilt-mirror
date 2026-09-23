import { createHash } from "crypto";
import { PAYU_MODE } from "./_publicConfigs";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";

export type PayUSIResponse = {
  status: number | string;
  msg: string;
  [key: string]: any;
};

const PAYU_TEST_URL = "https://test.payu.in/merchant/postservice.php?form=2";
const PAYU_PROD_URL = "https://info.payu.in/merchant/postservice.php?form=2";

/**
 * Generates the SHA512 hash for a PayU SI command.
 */
export function generatePayUSIHash(
  key: string,
  command: string,
  var1: string,
  salt: string
): string {
  const hashString = `${key}|${command}|${var1}|${salt}`;
  return createHash("sha512").update(hashString).digest("hex");
}

/**
 * Core utility to call any PayU SI command endpoint.
 */
export async function callPayUSICommand(
  command: string,
  var1Json: Record<string, any>
): Promise<PayUSIResponse> {
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error(`[callPayUSICommand] Missing PayU credentials for command: ${command}`);
    return { status: 0, msg: "Missing server configuration" };
  }

  const var1 = JSON.stringify(var1Json);
  const hash = generatePayUSIHash(PAYU_MERCHANT_KEY, command, var1, PAYU_MERCHANT_SALT);
  const apiUrl = PAYU_MODE === "production" ? PAYU_PROD_URL : PAYU_TEST_URL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[callPayUSICommand] Request timeout (30s) for command ${command}`);
    controller.abort();
  }, 30000);

  try {
    const formData = new URLSearchParams();
    formData.append("key", PAYU_MERCHANT_KEY);
    formData.append("command", command);
    formData.append("var1", var1);
    formData.append("hash", hash);

    console.log(`[callPayUSICommand] Calling PayU API command ${command}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[callPayUSICommand] ERROR for ${command}: HTTP ${response.status} - ${errorText}`
      );
      return { status: 0, msg: `HTTP Error ${response.status}` };
    }

    const result = await response.json();
    console.log(`[callPayUSICommand] ${command} response status: ${result.status}`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[callPayUSICommand] TIMEOUT for ${command}`);
      return { status: 0, msg: "Request timed out" };
    }
    console.error(`[callPayUSICommand] EXCEPTION for ${command}:`, error);
    return { status: 0, msg: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Sends a pre-debit notification, which is mandatory 24-48 hours before an actual recurring charge.
 */
export async function sendPreDebitNotification(params: {
  authPayuId: string;
  amount: number | string;
}): Promise<{ success: boolean; message: string }> {
  console.log(`[sendPreDebitNotification] Initiating for mandate ${params.authPayuId}`);

  // Tomorrow as an Indian date (yyyy-mm-dd); the server clock runs on UTC.
  const debitDate = addDays(new Date(), 1).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const amountStr =
    typeof params.amount === "number"
      ? params.amount.toFixed(2)
      : parseFloat(params.amount).toFixed(2);

  const var1Json = {
    authPayuId: params.authPayuId,
    requestId: nanoid(),
    debitDate,
    amount: amountStr,
  };

  const response = await callPayUSICommand("pre_debit_SI", var1Json);

  if (response.status === 1 || response.status === "1") {
    console.log(`[sendPreDebitNotification] Success for mandate ${params.authPayuId}`);
    return { success: true, message: response.msg || "Pre-debit notification sent" };
  }

  console.error(
    `[sendPreDebitNotification] Failed for mandate ${params.authPayuId}: ${response.msg}`
  );
  return { success: false, message: response.msg || "Failed to send pre-debit notification" };
}

/**
 * Executes a recurring charge (SI transaction) using an active mandate.
 */
export async function executeSITransaction(params: {
  authPayuId: string;
  txnid: string;
  amount: string;
  email: string;
  phone: string;
  firstname: string;
}): Promise<{
  success: boolean;
  status: string;
  message: string;
  mihpayid?: string;
  transactionId?: string;
}> {
  console.log(`[executeSITransaction] Initiating charge ${params.txnid} for mandate ${params.authPayuId}`);

  // si_transaction requires the lowercase "authpayuid"; "authPayuId" is rejected as a missing column.
  const var1Json = {
    authpayuid: params.authPayuId,
    txnid: params.txnid,
    amount: params.amount,
    email: params.email,
    phone: params.phone || "0000000000",
  };

  const response = await callPayUSICommand("si_transaction", var1Json);

  if (response.status === 1 || response.status === "1") {
    // status 1 only means PayU processed the request; the charge outcome is in details[txnid].status
    // (captured, pending, in-progress or failed).
    const detail = response.details?.[params.txnid] ?? {};
    const txStatus = String(detail.status ?? "").toLowerCase();
    let finalStatus = "pending";

    if (txStatus === "captured" || txStatus === "success") {
      finalStatus = "captured";
    } else if (txStatus === "failed" || txStatus === "failure") {
      finalStatus = "failed";
    }

    const message = detail.field9 || response.message || response.msg || "Transaction processed";
    if (finalStatus === "failed") {
      console.error(`[executeSITransaction] Transaction ${params.txnid} failed: ${message}`);
    } else {
      console.log(`[executeSITransaction] Transaction ${params.txnid} status: ${finalStatus} (${txStatus || "no status"})`);
    }

    return {
      success: finalStatus !== "failed",
      status: finalStatus,
      message,
      mihpayid: detail.payuid || undefined,
      transactionId: detail.transactionid,
    };
  }

  const errorMessage = response.message || response.msg || "Transaction failed";
  console.error(`[executeSITransaction] API error for charge ${params.txnid}: ${errorMessage}`);
  return { success: false, status: "failed", message: errorMessage };
}

/**
 * Checks the status of an existing mandate.
 */
export async function checkMandateStatus(
  authPayuId: string,
  paymentMode?: string | null
): Promise<{ success: boolean; mandateStatus: string; message: string }> {
  console.log(`[checkMandateStatus] Checking mandate ${authPayuId}`);

  let command = "check_mandate_status";
  if (paymentMode) {
    if (paymentMode.toUpperCase().startsWith("UPI")) command = "upi_mandate_status";
    else if (paymentMode.toUpperCase().startsWith("NB")) command = "NB_mandate_status";
  }

  // check_mandate_status (cards) refuses a request without requestId; UPI accepts it.
  const response = await callPayUSICommand(command, { authPayuId, requestId: nanoid() });

  // Card mandates answer status 1 plus mandate_status; UPI mandates put the state itself in
  // status (e.g. "active"). 0 means PayU has no such mandate.
  const apiStatus = String(response.status ?? "").toLowerCase();
  if (apiStatus !== "" && apiStatus !== "0") {
    const mandateStatus = String(apiStatus === "1" ? response.mandate_status || "active" : apiStatus).toLowerCase();
    console.log(`[checkMandateStatus] Status for ${authPayuId}: ${mandateStatus}`);
    return {
      success: true,
      mandateStatus,
      message: response.message || response.msg || "Mandate status checked",
    };
  }

  const errorMessage = response.message || response.msg || "Failed to check mandate status";
  console.error(`[checkMandateStatus] Failed to check status for ${authPayuId}: ${errorMessage}`);
  return {
    success: false,
    mandateStatus: "unknown",
    message: errorMessage,
  };
}

/**
 * Revokes/cancels an active mandate.
 */
export async function revokeMandate(
  authPayuId: string,
  paymentMode?: string | null
): Promise<{ success: boolean; message: string }> {
  console.log(`[revokeMandate] Revoking mandate ${authPayuId}`);

  let command = "mandate_revoke";
  if (paymentMode && paymentMode.toUpperCase().startsWith("UPI")) {
    command = "upi_mandate_revoke";
  }

  const response = await callPayUSICommand(command, { authPayuId, requestId: nanoid() });

  if (response.status === 1 || response.status === "1") {
    console.log(`[revokeMandate] Successfully revoked mandate ${authPayuId}`);
    return { success: true, message: response.msg || "Mandate revoked successfully" };
  }

  console.error(`[revokeMandate] Failed to revoke mandate ${authPayuId}: ${response.msg}`);
  return { success: false, message: response.msg || "Failed to revoke mandate" };
}