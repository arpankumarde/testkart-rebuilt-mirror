import { escapeHtmlAttribute } from "./escapeHtmlAttribute";

// Every endpoint that builds PayU form data posts to one of these two.
const PAYU_PAYMENT_URLS = new Set([
  "https://test.payu.in/_payment",
  "https://secure.payu.in/_payment",
]);

export const isPayuPaymentUrl = (url: string): boolean => PAYU_PAYMENT_URLS.has(url);

/**
 * The auto-submitting page that hands the browser over to PayU. Every
 * interpolated value is attribute-escaped; callers must check the URL with
 * isPayuPaymentUrl first.
 */
export function buildPayuRedirectHtml(
  payuUrl: string,
  fields: { [key: string]: string | undefined }
): string {
  const formInputs = Object.entries(fields)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => `<input type="hidden" name="${escapeHtmlAttribute(key)}" value="${escapeHtmlAttribute(value)}" />`)
    .join("\n");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to Payment Gateway</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f4f4; }
        .container { text-align: center; padding: 20px; border-radius: 8px; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Processing your payment...</h1>
        <p>Please wait while we securely redirect you to the payment gateway. Do not refresh or close this page.</p>
        <div class="loader"></div>
      </div>
      <form action="${escapeHtmlAttribute(payuUrl)}" method="POST" name="payuForm" id="payuForm">
        ${formInputs}
        <noscript>
          <p>JavaScript is disabled. Please click the button below to continue.</p>
          <input type="submit" value="Proceed to Payment" />
        </noscript>
      </form>
      <script type="text/javascript">
        document.getElementById('payuForm').submit();
      </script>
    </body>
    </html>
  `;
}
