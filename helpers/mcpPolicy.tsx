/**
 * What the MCP connector may reach on the admin API.
 *
 * Reads cover the admin surfaces exposed by the read tool; writes are limited to content.
 * This mirrors the allowlist shipped with the testkart-admin Claude Code plugin
 * (shared/policy.mjs) - keep the two in step when either changes.
 */

export const MCP_WRITE_ALLOWLIST = [
  "admin/blog/posts/upsert",
  "admin/blog/posts/delete",
  "admin/blog/categories/upsert",
  "admin/blog/categories/delete",
  "admin/blog/comments/moderate",
  "admin/news/upsert",
  "admin/news/delete",
  "admin/careers/create",
  "admin/careers/update",
  "admin/careers/delete",
  "admin/careers/delete-application",
  "admin/exam-content/upsert",
  "admin/exam-content/publish",
  "admin/exam-content/unpublish",
  "admin/exam-content/delete",
] as const;

export const MCP_DESTRUCTIVE = [
  "admin/blog/posts/delete",
  "admin/blog/categories/delete",
  "admin/news/delete",
  "admin/careers/delete",
  "admin/careers/delete-application",
  "admin/exam-content/delete",
] as const;

const WRITE_SET: ReadonlySet<string> = new Set(MCP_WRITE_ALLOWLIST);
const DESTRUCTIVE_SET: ReadonlySet<string> = new Set(MCP_DESTRUCTIVE);

export class McpPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpPolicyError";
  }
}

export function isMcpWritable(routeKey: string): boolean {
  return WRITE_SET.has(routeKey);
}

export function isMcpDestructive(routeKey: string): boolean {
  return DESTRUCTIVE_SET.has(routeKey);
}

/** Throw unless routeKey is an allowlisted content write. */
export function assertMcpWritable(routeKey: string): void {
  if (!WRITE_SET.has(routeKey)) {
    throw new McpPolicyError(
      `Refused: ${routeKey} is outside the connector's write scope. Writes are limited to blog ` +
        "and knowledge-base posts, categories, comments, news, careers and exam content pages."
    );
  }
}

export function describeMcpScope() {
  return {
    read: "Reads cover the admin surfaces exposed by the testkart_read tool.",
    write: [...MCP_WRITE_ALLOWLIST].sort(),
    requiresConfirmation: [...MCP_DESTRUCTIVE].sort(),
  };
}
