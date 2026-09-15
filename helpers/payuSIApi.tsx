import { createHash } from "crypto";
import { PAYU_MODE } from "./_publicConfigs";
import { nanoid } from "nanoid";
import { format, addDays } from "date-fns";

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

  const debitDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
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

  const var1Json = {
    authPayuId: params.authPayuId,
    txnid: params.txnid,
    amount: params.amount,
    email: params.email,
    phone: params.phone || "0000000000",
    firstname: params.firstname || "User",
  };

  const response = await callPayUSICommand("si_transaction", var1Json);

  if (response.status === 1 || response.status === "1") {
    const txStatus = String(response.transaction_status || response.status).toLowerCase();
    let finalStatus = "pending";

    if (txStatus === "captured" || txStatus === "success" || txStatus === "1") {
      finalStatus = "captured";
    } else if (txStatus === "failed" || txStatus === "failure" || txStatus === "0") {
      finalStatus = "failed";
    }

    if (finalStatus === "failed") {
        console.error(`[executeSITransaction] Transaction ${params.txnid} failed: ${response.msg}`);
    } else {
        console.log(`[executeSITransaction] Transaction ${params.txnid} status: ${finalStatus}`);
    }

    return {
      success: finalStatus !== "failed",
      status: finalStatus,
      message: response.msg || "Transaction processed",
      mihpayid: response.mihpayid,
      transactionId: response.transaction_id,
    };
  }

  console.error(`[executeSITransaction] API error for charge ${params.txnid}: ${response.msg}`);
  return { success: false, status: "failed", message: response.msg || "Transaction failed" };
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

  const response = await callPayUSICommand(command, { authPayuId });

  if (response.status === 1 || response.status === "1") {
    console.log(`[checkMandateStatus] Status for ${authPayuId}: ${response.mandate_status}`);
    return {
      success: true,
      mandateStatus: response.mandate_status || "ACTIVE",
      message: response.msg || "Mandate status checked",
    };
  }

  console.error(`[checkMandateStatus] Failed to check status for ${authPayuId}: ${response.msg}`);
  return {
    success: false,
    mandateStatus: "UNKNOWN",
    message: response.msg || "Failed to check mandate status",
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