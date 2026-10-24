export function parseErrorMessage(error: unknown): string {
  try {
    let msg = "";

    if (error instanceof Error) {
      msg = error.message;
    } else if (typeof error === "string") {
      msg = error;
    } else if (error && typeof error === "object" && "message" in error) {
      msg = String((error as Record<string, unknown>).message);
    } else {
      msg = String(error);
    }

    if (!msg || msg === "[object Object]") {
      return "Something went wrong. Please try again.";
    }

    const trimmed = msg.trim();

    // The server answered with an HTML page (timeout or gateway error) and the client failed to read it as JSON.
    if (
      /<!doctype|<html|unexpected token '<'|is not valid json|json\.parse:|json parse error/i.test(trimmed) ||
      (error instanceof SyntaxError && /json/i.test(trimmed))
    ) {
      return "The server did not respond properly. Please try again in a moment.";
    }

    // Check if it's a JSON stringified Zod array or similar
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const messages = parsed
            .map((e: unknown) => {
              if (e && typeof e === "object" && "message" in e) {
                return String((e as Record<string, unknown>).message);
              }
              return null;
            })
            .filter(Boolean);
            
          if (messages.length > 0) {
                        return messages.join(" ");
          }
        }
      } catch (e) {
        // Ignore parse errors and fall back to raw message
      }
    }

    // Check if it's a JSON stringified object containing a message
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && "message" in parsed) {
          return String((parsed as Record<string, unknown>).message);
        }
      } catch (e) {
        // Ignore parse errors and fall back to raw message
      }
    }

    return msg;
  } catch (e) {
    return "Something went wrong. Please try again.";
  }
}