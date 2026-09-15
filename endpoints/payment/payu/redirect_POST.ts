import { schema } from "./redirect_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { buildPayuRedirectHtml, isPayuPaymentUrl } from "../../../helpers/payuRedirectForm";

// Static text only: anything derived from the request stays in the server log.
function generateErrorHtml(message: string): string {
  return `
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>Payment Initiation Failed</h1>
        <p>${message}</p>
      </body>
      </html>
    `;
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const requestFormData = await request.formData();
    const superjsonData = requestFormData.get("superjsonData");

    if (!superjsonData || typeof superjsonData !== "string") {
      throw new Error("Missing or invalid superjsonData field in form submission");
    }

    const json = superjson.parse(superjsonData);
    const { payuUrl, ...formData } = schema.parse(json);

    if (!isPayuPaymentUrl(payuUrl)) {
      throw new Error("payuUrl is not a PayU payment URL");
    }

    return htmlResponse(buildPayuRedirectHtml(payuUrl, formData), 200);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return htmlResponse(
        generateErrorHtml("Your session has expired. Please sign in again and retry the payment."),
        401
      );
    }
    console.error("PayU redirect endpoint failed:", error);
    return htmlResponse(
      generateErrorHtml("There was an error processing your payment request. Please try again."),
      400
    );
  }
}
