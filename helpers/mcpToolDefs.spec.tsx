import { canCallAdminApi } from "./adminPermissions";
import { assertMcpWritable, isMcpDestructive, isMcpWritable, MCP_WRITE_ALLOWLIST } from "./mcpPolicy";

// mcpToolDefs pulls in the admin endpoints, and getAdminSession refuses to load without a JWT
// secret, so the module is imported once a placeholder secret is set.
type ToolDefsModule = typeof import("./mcpToolDefs");
type ToolsModule = typeof import("./mcpTools");

describe("admin MCP tool definitions", () => {
  let defs: ToolDefsModule;
  let tools: ToolsModule;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "spec-only-secret";
    defs = await import("./mcpToolDefs");
    tools = await import("./mcpTools");
  });

  const toolNames = (permissions: readonly string[]) =>
    defs.buildToolDefinitions(permissions).map((tool) => tool.name);

  it("routes every write tool through an allowlisted admin route", () => {
    for (const [name, route] of Object.entries(defs.TOOL_WRITE_ROUTES)) {
      expect(isMcpWritable(route)).withContext(name).toBe(true);
    }
    expect(Object.values(defs.TOOL_WRITE_ROUTES).sort()).toEqual([...MCP_WRITE_ALLOWLIST].sort());
  });

  it("exposes exam_content_ready_for_review with the exam content tools", () => {
    expect(defs.TOOL_WRITE_ROUTES.exam_content_ready_for_review).toBe("admin/exam-content/ready-for-review");
    expect(() => assertMcpWritable("admin/exam-content/ready-for-review")).not.toThrow();
    expect(isMcpDestructive("admin/exam-content/ready-for-review")).toBe(false);

    const withExamContent = toolNames(["exam_content"]);
    expect(withExamContent).toContain("exam_content_upsert");
    expect(withExamContent).toContain("exam_content_ready_for_review");
    expect(toolNames(["blog"])).not.toContain("exam_content_ready_for_review");

    const tool = defs.buildToolDefinitions(["exam_content"]).find((t) => t.name === "exam_content_ready_for_review");
    expect(tool?.inputSchema.required).toEqual(["examId", "pageType", "readyForReview"]);
  });

  it("lists exam-products/counts only for admins with exam content access", () => {
    expect(tools.listReadRoutes()).toContain("exam-products/counts");
    expect(tools.listPermittedReadRoutes(["exam_content"])).toContain("exam-products/counts");
    expect(tools.listPermittedReadRoutes(["blog"])).not.toContain("exam-products/counts");
    expect(tools.listPermittedReadRoutes([])).not.toContain("exam-products/counts");
  });

  it("only lists read paths the admin's access opens", () => {
    for (const path of tools.listPermittedReadRoutes(["blog"])) {
      expect(canCallAdminApi(["blog"], path)).withContext(path).toBe(true);
    }
  });

  it("no longer says exam content is rendered without sanitising", () => {
    expect(defs.SERVER_INSTRUCTIONS).not.toContain("without sanitising");
    expect(defs.SERVER_INSTRUCTIONS).toContain("sanitised on render");
    const upsert = defs.buildToolDefinitions(["exam_content"]).find((t) => t.name === "exam_content_upsert");
    expect(JSON.stringify(upsert)).not.toContain("without sanitising");
  });
});
