import { schema, type InputType } from "./redirect_POST.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

/**
 * The site's Content Security Policy only lets app pages post forms to our own origin, and
 * Cashfree's SDK opens checkout (popup or redirect) by posting a form to cashfree.com.
 * Endpoint responses are served without that policy, so the SDK runs here instead.
 * kind "order": loaded inside the popup frame from helpers/cashfreeCheckout and opens
 * Cashfree's popup, reporting back to the parent page with postMessage.
 * kind "subscription": loaded as a full page and hands the tab to Cashfree's autopay page.
 */

const STYLE = `
  html, body { margin: 0; height: 100%; }
  body { font-family: "Plus Jakarta Sans", Arial, sans-serif; display: flex; align-items: center; justify-content: center; color: #2b1d14; }
  body.full { background: #fbf7f2; }
  body.popup { background: transparent; }
  .box { max-width: 420px; margin: 16px; padding: 28px 24px; text-align: center; background: #ffffff; border: 1px solid #e6dccf; border-radius: 12px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 15px; line-height: 1.5; margin: 0; color: #4a3a2e; }
  .loader { width: 36px; height: 36px; margin: 20px auto 0; border: 4px solid #eadfd2; border-top-color: #903209; border-radius: 50%; animation: spin 1s linear infinite; }
  a { display: inline-block; margin-top: 18px; padding: 10px 18px; border-radius: 8px; background: #903209; color: #ffffff; text-decoration: none; font-weight: 600; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const page = (bodyClass: string, body: string, script = ""): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening payment</title>
<style>${STYLE}</style>
</head>
<body class="${bodyClass}">
<div class="box" id="box">${body}</div>
${script}
</body>
</html>`;

const html = (content: string, status: number): Response =>
  new Response(content, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

// Static messages only. Inside the popup frame it closes the popup and hands the message to the page.
const failurePage = (message: string): string =>
  page(
    "full",
    `<h1>Payment could not start</h1><p>${message}</p><a href="javascript:history.back()">Go back</a>`,
    `<script>if (window.parent !== window) window.parent.postMessage({ type: "testkart-cashfree", status: "error", message: ${JSON.stringify(
      message
    )} }, window.location.origin);</script>`
  );

function checkoutPage(input: InputType): string {
  const config = JSON.stringify(input).replace(/</g, "\\u003c");
  const script = `<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
<script>
(function () {
  var cfg = ${config};
  var inPopup = cfg.kind === "order" && window.parent !== window;
  function report(status, message) {
    window.parent.postMessage({ type: "testkart-cashfree", status: status, message: message || "" }, window.location.origin);
  }
  function fail(message) {
    message = message || "Please go back and try again.";
    if (inPopup) return report("error", message);
    document.getElementById("box").innerHTML = '<h1>Payment could not start</h1><p></p><a href="javascript:history.back()">Go back</a>';
    document.querySelector("#box p").textContent = message;
  }
  if (!window.Cashfree) return fail("The payment window could not be loaded. Check your connection and try again.");
  var cashfree = window.Cashfree({ mode: cfg.mode });
  var started = cfg.kind === "subscription"
    ? cashfree.subscriptionsCheckout({ subsSessionId: cfg.sessionId, redirectTarget: "_self" })
    : cashfree.checkout({ paymentSessionId: cfg.sessionId, redirectTarget: inPopup ? "_modal" : "_self" });
  Promise.resolve(started).then(function (result) {
    if (result && result.error) return fail(result.error.message);
    if (inPopup && result && result.paymentDetails) report("done");
  }, function (err) {
    fail(err && err.message);
  });
})();
</script>`;
  return input.kind === "order"
    ? page("popup", `<div class="loader"></div>`, script)
    : page("full", `<h1>Opening secure payment</h1><p>Please wait and do not close this page.</p><div class="loader"></div>`, script);
}

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);
    const form = await request.formData();
    const input = schema.parse({ kind: form.get("kind"), sessionId: form.get("sessionId"), mode: form.get("mode") });
    return html(checkoutPage(input), 200);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return html(failurePage("Your session has expired. Please sign in again and retry the payment."), 401);
    }
    console.error("Cashfree redirect failed:", error);
    return html(failurePage("Please go back and try again."), 400);
  }
}
