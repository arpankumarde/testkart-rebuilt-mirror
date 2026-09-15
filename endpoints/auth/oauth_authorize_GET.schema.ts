import { z } from "zod";
import { oauthProviders } from "../../helpers/OAuthProvider";

export const schema = z.object({
  provider: z.enum(oauthProviders, {
    errorMap: () => ({ message: "Invalid OAuth provider" }),
  }),
  role: z.enum(['student', 'teacher']).optional().default('student'),
  redirectTo: z.string().optional(),
  link_account: z.string().optional(), // 'true' if linking to existing account
});

export type InputType = z.infer<typeof schema>;

// For normal web flow this redirects (void), for mobile deep link flow returns JSON
export type OutputType = void | { redirectUrl: string };

export const getAuthOauthAuthorize = async (
  params: { provider: string; role?: 'student' | 'teacher'; redirectTo?: string; link_account?: string },
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(params);

  const url = new URL(`/_api/auth/oauth_authorize`);
  url.searchParams.set("provider", validatedInput.provider);
  if (validatedInput.role) {
    url.searchParams.set("role", validatedInput.role);
  }
  if (validatedInput.redirectTo) {
    url.searchParams.set("redirectTo", validatedInput.redirectTo);
  }
  if (validatedInput.link_account) {
    url.searchParams.set("link_account", validatedInput.link_account);
  }

  const result = await fetch(url.toString(), {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    throw new Error(`OAuth authorization failed: ${result.statusText}`);
  }

  // For mobile deep link flow, the server returns JSON with the auth URL
  if (result.status === 200) {
    return result.json() as Promise<{ redirectUrl: string }>;
  }

  // For normal web flow, the server redirects (no body to return)
};
