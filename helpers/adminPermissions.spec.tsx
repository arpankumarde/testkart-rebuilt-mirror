import {
  ADMIN_MODULE_KEYS,
  adminApiRouteKey,
  adminApiRule,
  canCallAdminApi,
  normalizeAdminPermissions,
} from "./adminPermissions";
import { adminNavigation } from "./adminNavigation";

describe("adminPermissions", () => {
  it("normalises the route key from any path form", () => {
    expect(adminApiRouteKey("/_api/admin/blog/posts/list")).toBe("admin/blog/posts/list");
    expect(adminApiRouteKey("admin/blog/posts/list")).toBe("admin/blog/posts/list");
    expect(adminApiRouteKey("/admin/blog/posts/list/")).toBe("admin/blog/posts/list");
  });

  it("picks the longest matching prefix", () => {
    expect(adminApiRule("/_api/admin/blog/comments/list")).toEqual(["blog_comments"]);
    expect(adminApiRule("/_api/admin/blog/posts/list")).toEqual(["blog"]);
    expect(adminApiRule("/_api/admin/exams/list")).toBe("any");
    expect(adminApiRule("/_api/admin/exams/create")).toEqual(["exam_content"]);
    expect(adminApiRule("/_api/admin/content/dashboard")).toEqual(["content"]);
    expect(adminApiRule("/_api/admin/content-reviews/list")).toEqual(["content_reviews"]);
    expect(adminApiRule("/_api/admin/settings/subscription")).toEqual(["subscriptions"]);
    expect(adminApiRule("/_api/admin/settings/ai-provider")).toEqual(["settings"]);
  });

  it("refuses unmapped admin paths", () => {
    expect(adminApiRule("/_api/admin/something-new")).toBeUndefined();
    expect(canCallAdminApi(ADMIN_MODULE_KEYS, "/_api/admin/something-new")).toBe(false);
  });

  it("gates by the modules held", () => {
    expect(canCallAdminApi([], "/_api/admin/session")).toBe(true);
    expect(canCallAdminApi([], "/_api/admin/orders/refund")).toBe(false);
    expect(canCallAdminApi(["transactions"], "/_api/admin/orders/refund")).toBe(true);
    expect(canCallAdminApi(["students"], "/_api/admin/impersonate")).toBe(true);
    expect(canCallAdminApi(["courses"], "/_api/admin/content-preview/details")).toBe(true);
    expect(canCallAdminApi(["blog"], "/_api/admin/admins/update-permissions")).toBe(false);
    expect(canCallAdminApi(["admins"], "/_api/admin/admins/update-permissions")).toBe(true);
    expect(canCallAdminApi(["teachers"], "/_api/admin/organizations/list")).toBe(true);
    expect(canCallAdminApi(["teachers"], "/_api/admin/organizations/set-active")).toBe(true);
    expect(canCallAdminApi(["students"], "/_api/admin/organizations/list")).toBe(false);
  });

  it("drops unknown keys and keeps catalogue order", () => {
    expect(normalizeAdminPermissions(["blog", "nope", "dashboard", "blog"])).toEqual(["dashboard", "blog"]);
    expect(normalizeAdminPermissions(null)).toEqual([]);
  });

  it("gives every sidebar item at least one real module", () => {
    for (const group of adminNavigation.groups) {
      for (const item of group.items) {
        expect(item.modules.length).toBeGreaterThan(0);
        expect(item.modules.every((m) => ADMIN_MODULE_KEYS.includes(m))).toBe(true);
      }
    }
  });

  it("finds the Support inbox by its path although its link carries ?status=open", () => {
    const support = adminNavigation.findByPath("/admin/support");
    expect(support?.label).toBe("Support inbox");
    expect(support?.href).toBe("/admin/support?status=open");
    expect(adminNavigation.findByPath("/admin/support?status=resolved&thread=4")?.label).toBe("Support inbox");
    expect(adminNavigation.findByPath("/admin/teachers/earnings")?.label).toBe("Teacher earnings");
  });

  it("still gates the Support inbox by its module", () => {
    expect(adminNavigation.canOpen("/admin/support", ["blog"])).toBe(false);
    expect(adminNavigation.canOpen("/admin/support?status=open", ["blog"])).toBe(false);
    expect(adminNavigation.canOpen("/admin/support?status=open", ["support"])).toBe(true);
  });

  it("routes pages by module and sends admins without access home", () => {
    expect(adminNavigation.canOpen("/admin/teachers/earnings", ["teachers"])).toBe(false);
    expect(adminNavigation.canOpen("/admin/teachers/earnings", ["teacher_earnings"])).toBe(true);
    expect(adminNavigation.canOpen("/admin/organizations/12", ["teachers"])).toBe(true);
    expect(adminNavigation.canOpen("/admin/organizations", ["students"])).toBe(false);
    expect(adminNavigation.canOpen("/admin/profile", [])).toBe(true);
    expect(adminNavigation.canOpen("/admin/settings", ["admins"])).toBe(true);
    expect(adminNavigation.canOpen("/admin/settings", ["blog"])).toBe(true);
    expect(adminNavigation.canOpen("/admin/settings", null)).toBe(false);
    expect(adminNavigation.canOpen("/admin/preview/course/1", ["blog"])).toBe(false);
    expect(adminNavigation.homeHref([])).toBe("/admin/profile");
    expect(adminNavigation.homeHref(["blog", "support"])).toBe("/admin/support?status=open");
    expect(adminNavigation.homeHref([...ADMIN_MODULE_KEYS])).toBe("/admin/dashboard");
  });
});
