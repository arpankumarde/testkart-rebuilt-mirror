import { Resend } from "resend";

// Lazy-initialize Resend to avoid accessing process.env at module scope
// (process.env is only available on the server-side in Floot).
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export type ContactMetadata = {
  role?: "student" | "teacher" | "admin";
  userId?: number | string;
  [key: string]: string | number | undefined;
};

export type SyncContactParams = {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
  audienceId: string;
  metadata?: ContactMetadata;
};

export type ResendContactResult =
  | { success: true; data: any }
  | { success: false; error: any };

/**
 * Adds or updates a contact in a specific Resend audience.
 * This function should only be called from server-side code.
 */
export const syncContact = async ({
  email,
  firstName,
  lastName,
  unsubscribed,
  audienceId,
  metadata,
}: SyncContactParams): Promise<ResendContactResult> => {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not defined.");
    return {
      success: false,
      error: new Error("Email service configuration missing"),
    };
  }

  try {
    // Resend's create contact endpoint handles both creation and updates (upsert behavior)
    // if the email already exists in the audience.
        const data = await getResend().contacts.create({
      email,
      firstName,
      lastName,
      unsubscribed,
      audienceId,
      // In Resend SDK, custom data is stored via 'properties' field
      // Filter out undefined values and convert to required format
      ...(metadata && {
        properties: Object.fromEntries(
          Object.entries(metadata).filter(([_, v]) => v !== undefined)
        ) as Record<string, string | number>,
      }),
    });

    if (data.error) {
      console.error("Resend Contact Sync Error:", data.error);
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to sync contact with Resend:", error);
    return { success: false, error };
  }
};

/**
 * Convenience function to add a contact to role-specific audiences.
 * Used primarily in registration and profile updates.
 */
export const addContactToAudience = async (
  email: string,
  firstName: string,
  role: "student" | "teacher",
  userId: number | string
): Promise<ResendContactResult> => {
  const audienceId =
    role === "teacher"
      ? process.env.RESEND_TEACHER_AUDIENCE_ID
      : process.env.RESEND_STUDENT_AUDIENCE_ID;

  if (!audienceId) {
    console.warn(`Resend ${role} audience ID not configured.`);
    return { success: false, error: new Error("Audience ID not configured") };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not defined.");
    return {
      success: false,
      error: new Error("Email service configuration missing"),
    };
  }

  try {
        const createResult = await getResend().contacts.create({
      email,
      audienceId,
      firstName,
      unsubscribed: false,
    });

    if (createResult.error) {
      console.error("Resend Create Error:", JSON.stringify(createResult.error));
      // If contact already exists, we return success as it serves as an upsert
      if (!createResult.error.message?.includes("already exists")) {
        return { success: false, error: createResult.error };
      }
    }

    return { success: true, data: createResult.data };
  } catch (error) {
    console.error("Failed to add contact:", error);
    return { success: false, error };
  }
};

/**
 * Helper to specifically add a user to an audience, wrapping syncContact.
 */
export const addToAudience = async (
  email: string,
  audienceId: string,
  data?: {
    firstName?: string;
    lastName?: string;
    metadata?: ContactMetadata;
  }
) => {
  return syncContact({
    email,
    audienceId,
    firstName: data?.firstName,
    lastName: data?.lastName,
    metadata: data?.metadata,
    unsubscribed: false,
  });
};

/**
 * Removes a contact from a specific audience.
 */
export const removeContact = async (
  email: string,
  audienceId: string
): Promise<ResendContactResult> => {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: new Error("Email service configuration missing"),
    };
  }

  try {
        const data = await getResend().contacts.remove({
      email,
      audienceId,
    });

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to remove contact from Resend:", error);
    return { success: false, error };
  }
};