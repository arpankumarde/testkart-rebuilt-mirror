import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  // Required PayU parameters
  key: z.string(),
  txnid: z.string(),
  amount: z.string(),
  productinfo: z.string(),
  firstname: z.string(),
  email: z.string().email(),
  phone: z.string(),
  surl: z.string().url(),
  furl: z.string().url(),
  hash: z.string(),
  payuUrl: z.string().url(),

  // Optional User Defined Fields (UDF) for passing custom data to the callback
  udf1: z.string().optional(),
  udf2: z.string().optional(),
  udf3: z.string().optional(),
  udf4: z.string().optional(),
  udf5: z.string().optional(),

  // Optional Standing Instruction (SI) parameters for recurring payments
  si: z.string().optional(),
  si_start_date: z.string().optional(), // YYYY-MM-DD
  si_end_date: z.string().optional(), // YYYY-MM-DD
  si_frequency: z.string().optional(),
  si_amount: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

// This endpoint returns an HTML page that auto-submits a form, not JSON.
// The client-side helper function facilitates this by creating and submitting a form.
export type OutputType = void;

/**
 * Submits payment data to the PayU redirect proxy endpoint.
 * This function creates a hidden form with the payment data, appends it to the body,
 * and submits it. The browser will then navigate to the proxy endpoint, which
 * returns an HTML page that auto-submits to the actual PayU gateway.
 * This is a workaround for Content Security Policy (CSP) restrictions.
 * @param body The payment data for PayU.
 */
export const postPaymentPayuRedirect = (body: InputType): void => {
  const validatedInput = schema.parse(body);

  // Create a form element
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/_api/payment/payu/redirect";
  form.style.display = "none"; // Hide the form

  // Create an input for the superjson stringified body
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "superjsonData"; // The backend will need to know how to parse this
  input.value = superjson.stringify(validatedInput);
  form.appendChild(input);

  // Append the form to the body and submit
  document.body.appendChild(form);
  form.submit();

  // It's good practice to remove the form after submission, though navigation will likely occur before this runs.
  document.body.removeChild(form);
};