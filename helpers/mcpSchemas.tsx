import { z } from "zod";

/**
 * Request shapes for the MCP connectors' endpoints, shared by the admin and teacher connectors.
 * Kept free of server imports so the endpoint schema files can re-export them.
 */

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export const authorizeQuerySchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  response_type: z.literal("code"),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal("S256"),
  state: z.string().optional(),
  scope: z.string().optional(),
  resource: z.string().optional(),
});

export const consentFormSchema = authorizeQuerySchema.extend({
  action: z.enum(["allow", "deny"]),
});

/** RFC 6749 token request. Clients post form fields, not a JSON body. */
export const tokenRequestSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1),
    redirect_uri: z.string().min(1),
    client_id: z.string().min(1),
    code_verifier: z.string().min(1),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    scope: z.string().optional(),
  }),
]);

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope?: string;
};

/** RFC 7591 dynamic client registration. Plain JSON, not superjson. */
export const registerRequestSchema = z.object({
  redirect_uris: z.array(z.string()).min(1),
  client_name: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  scope: z.string().optional(),
});

export type RegisterResponse = {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: "none";
};
