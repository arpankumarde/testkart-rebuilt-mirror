import { schema, OutputType } from "./ifsc-lookup_GET.schema";
import { getServerUserSession } from "../helpers/getServerUserSession";
import superjson from "superjson";
import { ZodError } from "zod";

/*
 * Razorpay's public IFSC directory. It answers 200 with the branch record, or
 * 404 with a plain-text body for an unknown code. No key, no rate limit
 * published - but this endpoint still requires a session so the app is not an
 * open proxy in front of it.
 */
const IFSC_DIRECTORY_URL = "https://ifsc.razorpay.com";
const LOOKUP_TIMEOUT_MS = 6000;

/* Only the fields the forms use. Everything else Razorpay returns (MICR,
   NEFT/RTGS/IMPS flags, address, contact) is dropped rather than passed on. */
type RazorpayIfscRecord = {
  IFSC?: unknown;
  BANK?: unknown;
  BRANCH?: unknown;
  CITY?: unknown;
  STATE?: unknown;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const url = new URL(request.url);
    const validatedInput = schema.parse({ ifsc: url.searchParams.get("ifsc") });

    let directoryResponse: Response;
    try {
      directoryResponse = await fetch(
        `${IFSC_DIRECTORY_URL}/${encodeURIComponent(validatedInput.ifsc)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        }
      );
    } catch (fetchError) {
      console.error("IFSC directory unreachable:", fetchError);
      return jsonResponse(
        {
          error: "Could not reach the bank directory.",
          notFound: false,
        },
        502
      );
    }

    if (directoryResponse.status === 404) {
      return jsonResponse(
        {
          error: `No bank branch is registered against ${validatedInput.ifsc}.`,
          notFound: true,
        },
        404
      );
    }

    if (!directoryResponse.ok) {
      console.error(
        "IFSC directory returned an unexpected status:",
        directoryResponse.status
      );
      return jsonResponse(
        {
          error: "The bank directory is not responding.",
          notFound: false,
        },
        502
      );
    }

    let record: RazorpayIfscRecord;
    try {
      record = (await directoryResponse.json()) as RazorpayIfscRecord;
    } catch (parseError) {
      console.error("IFSC directory returned an unreadable body:", parseError);
      return jsonResponse(
        { error: "The bank directory is not responding.", notFound: false },
        502
      );
    }

    const bank = asTrimmedString(record.BANK);
    if (!bank) {
      /* A 200 with no bank name is the directory contradicting itself. Treated
         as unreachable rather than as a bad IFSC, so the user is not told
         their correct code is wrong. */
      console.error("IFSC directory returned a record with no BANK field.");
      return jsonResponse(
        { error: "The bank directory is not responding.", notFound: false },
        502
      );
    }

    const payload: OutputType = {
      ifsc: asTrimmedString(record.IFSC) ?? validatedInput.ifsc,
      bank,
      branch: asTrimmedString(record.BRANCH),
      city: asTrimmedString(record.CITY),
      state: asTrimmedString(record.STATE),
    };

    return new Response(superjson.stringify(payload satisfies OutputType), {
      headers: {
        "Content-Type": "application/json",
        /* Branch records effectively never change; caching keeps repeated
           keystrokes on the same code off the upstream. */
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(
        { error: "Invalid IFSC format. It should be like SBIN0001234.", notFound: true },
        400
      );
    }
    console.error("IFSC lookup failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return jsonResponse({ error: errorMessage, notFound: false }, 500);
  }
}
