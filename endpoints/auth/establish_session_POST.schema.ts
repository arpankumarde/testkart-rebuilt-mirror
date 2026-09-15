import { z } from "zod";

export const schema = z.object({
  tempToken: z.string().min(1, "Temporary token is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      user: {
        id: number;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        role: "admin" | "teacher" | "student";
        mobileNumber?: string | null;
        mobileVerified?: boolean;
        onboardingCompleted?: boolean;
      };
      success: boolean;
      isNewUser?: boolean;
      redirectTo?: string;
    }
  | {
      error: string;
    };

export const postEstablishSession = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/establish_session`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return result.json();
};
