import { createHash } from "crypto";
import { PAYU_MODE } from "./_publicConfigs";

const PAYU_TEST_URL = "https://test.payu.in/merchant/postservice.php?form=2";
const PAYU_PROD_URL = "https://info.payu.in/merchant/postservice.php?form=2";
const REQUEST_TIMEOUT_MS = 15000;

export type PayUTransactionDetails = {
  mihpayid: string;
  request_id: string;
  bank_ref_num: string;
  amt: string;
  transaction_amount: string;
  txnid: string;
  additional_charges: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  status: string; // e.g., "success", "failure", "pending"
  unmappedstatus: string;
  mode: string;
  bank_name: string;
  card_type: string;
  card_no: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  udf6: string;
  udf7: string;
  udf8: string;
  udf9: string;
  udf10: string;
  error_code: string;
  error_Message: string;
  field9?: string;
  net_amount_debit: string;
  addedon: string;
  payment_source: string;
  PG_TYPE: string;
  encryptedPaymentId: string;
  lastname: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  issuing_bank: string;
  card_category: string;
  card_merchant_param: string;
  name_on_card: string;
  cardnum: string;
  cardhash: string;
};

type PayUVerifyResponse = {
  status: 0 | 1;
  msg: string;
  transaction_details?: {
    [txnid: string]: PayUTransactionDetails;
  };
};

export type PayULookupResult =
  | {
      ok: true;
      message: string;
      // null when PayU has no record of that txnid
      transactions: Record<string, PayUTransactionDetails | null>;
    }
  | {
      ok: false;
      status: "configuration_error" | "api_error" | "timeout" | "exception";
      error: string;
    };

/**
 * Calls the PayU Verify Payment API for one or more transaction IDs in a single request.
 * Server-side only; requires the PayU merchant key and salt.
 */
export async function lookupPayUTransactions(txnids: string[]): Promise<PayULookupResult> {
  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
  const label = txnids.length === 1 ? `txnid ${txnids[0]}` : `${txnids.length} txnids`;

  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    const errorMsg = "PayU merchant key or salt is not configured on the server.";
    console.error(`[lookupPayUTransactions] ERROR for ${label}: ${errorMsg}`);
    return { ok: false, status: "configuration_error", error: errorMsg };
  }

  const command = "verify_payment";
  const var1 = txnids.join("|");
  const hash = createHash("sha512")
    .update(`${PAYU_MERCHANT_KEY}|${command}|${var1}|${PAYU_MERCHANT_SALT}`)
    .digest("hex");

  const apiUrl = PAYU_MODE === "production" ? PAYU_PROD_URL : PAYU_TEST_URL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[lookupPayUTransactions] Request timeout (15s) for ${label}`);
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const formData = new URLSearchParams();
    formData.append("key", PAYU_MERCHANT_KEY);
    formData.append("command", command);
    formData.append("var1", var1);
    formData.append("hash", hash);

    console.log(`[lookupPayUTransactions] Calling PayU API for ${label}`);

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
      const errorMsg = `PayU API request failed with status ${response.status}: ${errorText}`;
      console.error(`[lookupPayUTransactions] ERROR for ${label}: ${errorMsg}`);
      return { ok: false, status: "api_error", error: errorMsg };
    }

    const result: PayUVerifyResponse = await response.json();

    // A genuine miss still lists the txnid as "Not Found"; no details at all means the call itself was rejected.
    if (result.status !== 1 && !result.transaction_details) {
      const errorMsg = `PayU returned no transaction details: ${result.msg}`;
      console.error(`[lookupPayUTransactions] ERROR for ${label}: ${errorMsg}`);
      return { ok: false, status: "api_error", error: errorMsg };
    }

    const transactions: Record<string, PayUTransactionDetails | null> = {};
    for (const txnid of txnids) {
      const details = result.status === 1 ? result.transaction_details?.[txnid] : undefined;
      const missing =
        !details || details.status === "Not Found" || details.mihpayid === "Not Found";
      transactions[txnid] = missing ? null : details;
    }

    return { ok: true, message: result.msg, transactions };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[lookupPayUTransactions] TIMEOUT for ${label}`);
      return { ok: false, status: "timeout", error: "PayU API request timed out after 15 seconds" };
    }

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred during payment verification.";
    console.error(`[lookupPayUTransactions] EXCEPTION for ${label}:`, error);
    return { ok: false, status: "exception", error: errorMessage };
  }
}