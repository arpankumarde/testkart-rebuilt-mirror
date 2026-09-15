import { SITE_ORIGIN } from "./shareLinks";

/**
 * Client-safe facts about the two MCP connectors, for the "Use Testkart from your AI assistant"
 * cards on the admin and teacher dashboards. The server side lives in helpers/mcpOauth, which
 * imports the database and so cannot be bundled into a page.
 */

export type AiConnectorAudience = "admin" | "teacher";

/** One app the viewer has connected, newest use first. */
export type AiConnection = {
  clientName: string;
  lastUsedAt: Date;
};

export const AI_CONNECTOR_NAMES: Record<AiConnectorAudience, string> = {
  admin: "Testkart admin",
  teacher: "Testkart teacher",
};

/** Must match mcpResourceUrl in helpers/mcpOauth. */
export const aiConnectorUrl = (audience: AiConnectorAudience): string => `${SITE_ORIGIN}/_api/mcp/${audience}`;

export type AiConnectorLinks = {
  url: string;
  name: string;
  /** Opens Claude's Add custom connector dialog with the name and URL filled in. */
  claude: string;
  /** The same dialog on the organisation settings path, for Team and Enterprise owners. */
  claudeOrganisation: string;
  chatgpt: string;
  perplexity: string;
};

export const aiConnectorLinks = (audience: AiConnectorAudience): AiConnectorLinks => {
  const url = aiConnectorUrl(audience);
  const name = AI_CONNECTOR_NAMES[audience];
  const prefill = `modal=add-custom-connector&connectorName=${encodeURIComponent(name)}&connectorUrl=${encodeURIComponent(url)}`;

  return {
    url,
    name,
    claude: `https://claude.ai/customize/connectors?${prefill}`,
    claudeOrganisation: `https://claude.ai/admin-settings/connectors?${prefill}`,
    chatgpt: "https://chatgpt.com/plugins",
    perplexity: "https://www.perplexity.ai/account/connectors",
  };
};