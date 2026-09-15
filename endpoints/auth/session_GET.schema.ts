import { z } from "zod";
import { User } from "../../helpers/User";
import superjson from "superjson";

// no schema, just a simple GET request
export const schema = z.object({});

export type OutputType =
  | {
      user: User;
      impersonatorAdminId?: number;
    }
  | {
      error: string;
    };

// Re-export for convenience — User already contains teacherRole and actingAsTeacherId
// so they are included in the OutputType's user field automatically.

export const getSession = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/auth/session`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  // Check content-type before parsing
  const contentType = result.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error("Session endpoint returned non-JSON response:", {
      status: result.status,
      contentType,
    });
    throw new Error("Session validation failed - server error");
  }

  // Use superjson to parse the response
  const text = await result.text();
  try {
    return superjson.parse<OutputType>(text);
  } catch (e) {
    console.error("Failed to parse session response:", e);
    throw new Error("Session validation failed - invalid response");
  }
};