import { z } from "zod";

export const schema = z.object({});

export type ProgressUpdate = {
  progress: true;
  current: number;
  total: number;
  synced: number;
  failed: number;
};

export type FinalResult = {
  complete: true;
  synced: number;
  failed: number;
  total: number;
  errors: string[];
};

export type ErrorResult = {
  complete: true;
  error: string;
};

export type StreamMessage = ProgressUpdate | FinalResult | ErrorResult;

export type OutputType = FinalResult;

/**
 * Streams the sync progress and returns the final result.
 * This function parses the NDJSON stream and returns the final summary.
 * 
 * @param body - Request body (empty for this endpoint)
 * @param init - Additional fetch options
 * @param onProgress - Optional callback for progress updates
 * @returns The final sync result
 */
export const postSyncContactsToResend = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/sync-contacts-to-resend`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorText = await result.text();
    try {
      const errorObject = JSON.parse(errorText);
      throw new Error(errorObject.error || "Request failed");
    } catch {
      throw new Error("Request failed");
    }
  }

  if (!result.body) {
    throw new Error("No response body");
  }

  const reader = result.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: OutputType | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line) as StreamMessage;

          if ("progress" in message && message.progress) {
            // This is a progress update
            onProgress?.(message);
          } else if ("complete" in message && message.complete) {
            // This is the final result
            if ("error" in message) {
              throw new Error(message.error);
            }
            finalResult = message as FinalResult;
          }
        } catch (error) {
          console.error("Failed to parse stream message:", line, error);
        }
      }
    }

    if (!finalResult) {
      throw new Error("No final result received from stream");
    }

    return finalResult;
  } finally {
    reader.releaseLock();
  }
};