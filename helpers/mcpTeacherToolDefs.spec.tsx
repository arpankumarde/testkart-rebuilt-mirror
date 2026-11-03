// mcpTeacherToolDefs pulls in the teacher endpoints, which refuse to load without a JWT secret, so
// the module is imported once a placeholder secret is set.
type TeacherToolDefsModule = typeof import("./mcpTeacherToolDefs");

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const;
const GENERIC_TOOLS = ["teacher_actions", "teacher_action_schema", "teacher_read", "teacher_write"];

describe("teacher MCP tool definitions", () => {
  let defs: TeacherToolDefsModule;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "spec-only-secret";
    defs = await import("./mcpTeacherToolDefs");
  });

  const tools = () => defs.buildTeacherToolDefinitions();
  const tool = (name: string) => {
    const found = tools().find((candidate) => candidate.name === name);
    if (!found) throw new Error(`missing tool ${name}`);
    return found;
  };

  it("gives every tool a title and explicit boolean hints", () => {
    for (const definition of tools()) {
      const annotations = definition.annotations ?? {};
      expect(typeof definition.title).withContext(definition.name).toBe("string");
      expect(annotations.title).withContext(definition.name).toBe(definition.title);
      for (const hint of HINTS) {
        expect(typeof annotations[hint]).withContext(`${definition.name}.${hint}`).toBe("boolean");
      }
      if (annotations.readOnlyHint) {
        expect(annotations.destructiveHint).withContext(definition.name).toBe(false);
      }
    }
  });

  it("exposes one valid, uniquely named tool per action and no generic dispatchers", () => {
    const names = tools().map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(100);
    for (const name of names) {
      expect(/^[a-z0-9_]{1,64}$/.test(name)).withContext(name).toBe(true);
    }
    for (const generic of GENERIC_TOOLS) expect(names).not.toContain(generic);
    for (const definition of tools()) {
      expect(definition.inputSchema.type).withContext(definition.name).toBe("object");
    }
  });

  it("maps tool names back to their actions", () => {
    expect(defs.teacherActionForTool("teacher_tests_list")).toBe("tests/list");
    expect(defs.teacherActionForTool("teacher_live_test_publish")).toBe("live-test/publish");
    expect(defs.teacherActionForTool("teacher_live_tests_publish")).toBe("live-tests/publish");
    expect(defs.teacherActionForTool("teacher_subscription_cancel")).toBeNull();
    expect(defs.teacherActionForTool("teacher_whoami")).toBeNull();
  });

  it("classifies reads, drafts, additive writes and destructive writes", () => {
    expect(tool("teacher_tests_list").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: true, destructiveHint: false, openWorldHint: false })
    );
    expect(tool("teacher_ai_rewrite").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: true, destructiveHint: false, openWorldHint: true })
    );
    expect(tool("teacher_questions_create").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: false, destructiveHint: false, idempotentHint: false })
    );
    expect(tool("teacher_courses_update").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: false, destructiveHint: true, idempotentHint: true })
    );
    expect(tool("teacher_trash_delete").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: false, destructiveHint: true })
    );
    expect(tool("teacher_withdrawal_request").annotations).toEqual(
      jasmine.objectContaining({ readOnlyHint: false, destructiveHint: true, openWorldHint: true })
    );
  });

  it("adds a confirm argument only to tools that need it", () => {
    const properties = (name: string) => tool(name).inputSchema.properties as Record<string, unknown>;
    expect(properties("teacher_courses_delete").confirm).toBeDefined();
    expect(properties("teacher_withdrawal_request").confirm).toBeDefined();
    expect(properties("teacher_courses_update").confirm).toBeUndefined();
  });

  it("names only exposed tools in the server instructions", () => {
    const names = new Set(tools().map((definition) => definition.name));
    const mentioned = defs.TEACHER_SERVER_INSTRUCTIONS.match(/teacher_[a-z0-9_]+\*?/g) ?? [];
    expect(mentioned.length).toBeGreaterThan(10);
    for (const name of mentioned) {
      const known = name.endsWith("*")
        ? [...names].some((candidate) => candidate.startsWith(name.slice(0, -1)))
        : names.has(name);
      expect(known).withContext(name).toBe(true);
    }
    for (const generic of GENERIC_TOOLS) {
      expect(defs.TEACHER_SERVER_INSTRUCTIONS).not.toContain(generic);
    }
  });
});
