export type ApiParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type ApiResponseField = {
  name: string;
  type: string;
  description: string;
};

/*
 * none: never reads a session. optional: public, personalised when a session is sent.
 * signature: no user session, a provider hash or signature carries the trust (PayU, Mux).
 * oauth: an MCP connector access token.
 */
export type ApiAuth = "none" | "optional" | "student" | "teacher" | "any" | "admin" | "signature" | "oauth";

/* The first-party clients that call an endpoint. The shipped mobile app pins every endpoint it calls. */
export type ApiClient = "web" | "mobile";

export type ApiEndpoint = {
  method: "GET" | "POST";
  route: string;
  description: string;
  auth: ApiAuth;
  category: string;
  usedBy: ApiClient[];
  /* What to use instead and why the endpoint is still live. */
  deprecated?: string;
  queryParams?: ApiParam[];
  bodyParams?: ApiParam[];
  responseFields: ApiResponseField[];
  notes?: string[];
};

export const API_AUTH_LABELS: Record<ApiAuth, string> = {
  none: "Public",
  optional: "Public, reads session",
  student: "Student",
  teacher: "Teacher",
  any: "Any signed-in user",
  admin: "Admin",
  signature: "Provider signature",
  oauth: "MCP OAuth token",
};

export const isMobileOnly = (endpoint: ApiEndpoint) =>
  endpoint.usedBy.length === 1 && endpoint.usedBy[0] === "mobile";

export const isWebOnly = (endpoint: ApiEndpoint) =>
  endpoint.usedBy.length === 1 && endpoint.usedBy[0] === "web";
