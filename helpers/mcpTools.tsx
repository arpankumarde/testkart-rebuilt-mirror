/**
 * Bridges MCP tool calls onto the existing admin endpoints.
 *
 * Floot forbids an endpoint from fetching another endpoint, so rather than issuing HTTP requests
 * this imports each admin endpoint's `handle` and invokes it with a synthetic Request. That reuses
 * every endpoint's own auth, validation and business logic instead of reimplementing it here.
 *
 * The synthetic Request carries a freshly minted, short-lived admin session cookie. The admin is
 * loaded from the database on every call, so a deactivated account stops working immediately
 * rather than when a stored token happens to expire.
 */

import { AdminProfile } from "./AdminTypes";
import { db } from "./db";
import { createAdminSessionToken } from "./getAdminSession";
import { assertMcpWritable } from "./mcpPolicy";
import { extractEndpointError, unwrapEndpointPayload } from "./mcpServer";
import { SITE_ORIGIN } from "./shareLinks";

import { handle as blogPostsList } from "../endpoints/admin/blog/posts/list_GET";
import { handle as blogPostsGet } from "../endpoints/admin/blog/posts/get_GET";
import { handle as blogCategoriesList } from "../endpoints/admin/blog/categories/list_GET";
import { handle as blogCommentsList } from "../endpoints/admin/blog/comments/list_GET";
import { handle as newsList } from "../endpoints/admin/news/list_GET";
import { handle as careersList } from "../endpoints/admin/careers/list_GET";
import { handle as careersApplications } from "../endpoints/admin/careers/applications_GET";
import { handle as contentDashboard } from "../endpoints/admin/content/dashboard_GET";
import { handle as contentReviewsList } from "../endpoints/admin/content-reviews/list_GET";
import { handle as dashboardOverview } from "../endpoints/admin/dashboard/overview_GET";
import { handle as dashboardTrends } from "../endpoints/admin/dashboard/trends_GET";
import { handle as adminStats } from "../endpoints/admin/stats_GET";
import { handle as studentsList } from "../endpoints/admin/students/list_GET";
import { handle as teachersList } from "../endpoints/admin/teachers/list_GET";
import { handle as deletedAccountsList } from "../endpoints/admin/deleted-accounts/list_GET";
import { handle as ordersList } from "../endpoints/admin/orders_GET";
import { handle as productsList } from "../endpoints/admin/products/list_GET";
import { handle as coursesList } from "../endpoints/admin/courses/list_GET";
import { handle as testsList } from "../endpoints/admin/tests/list_GET";
import { handle as liveTestsList } from "../endpoints/admin/live-tests/list_GET";
import { handle as bundlesList } from "../endpoints/admin/bundles/list_GET";
import { handle as examsList } from "../endpoints/admin/exams/list_GET";
import { handle as examCategoriesList } from "../endpoints/admin/exam-categories/list_GET";
import { handle as examContentList } from "../endpoints/admin/exam-content/list_GET";
import { handle as subscriptionsList } from "../endpoints/admin/subscriptions/list_GET";
import { handle as subscriptionTransactionsList } from "../endpoints/admin/subscription-transactions/list_GET";
import { handle as financeSummary } from "../endpoints/admin/finance/summary_GET";
import { handle as earningsList } from "../endpoints/admin/earnings/list_GET";
import { handle as withdrawalsList } from "../endpoints/admin/withdrawals/list_GET";
import { handle as studentWithdrawalsList } from "../endpoints/admin/student-withdrawals/list_GET";
import { handle as supportThreads } from "../endpoints/admin/support/threads_GET";
import { handle as contactSubmissionsList } from "../endpoints/admin/contact-submissions/list_GET";
import { handle as inquiriesList } from "../endpoints/admin/inquiries_GET";
import { handle as salesContacts } from "../endpoints/admin/sales/contacts_GET";

import { handle as blogPostsUpsert } from "../endpoints/admin/blog/posts/upsert_POST";
import { handle as blogPostsDelete } from "../endpoints/admin/blog/posts/delete_POST";
import { handle as blogCategoriesUpsert } from "../endpoints/admin/blog/categories/upsert_POST";
import { handle as blogCategoriesDelete } from "../endpoints/admin/blog/categories/delete_POST";
import { handle as blogCommentsModerate } from "../endpoints/admin/blog/comments/moderate_POST";
import { handle as newsUpsert } from "../endpoints/admin/news/upsert_POST";
import { handle as newsDelete } from "../endpoints/admin/news/delete_POST";
import { handle as careersCreate } from "../endpoints/admin/careers/create_POST";
import { handle as careersUpdate } from "../endpoints/admin/careers/update_POST";
import { handle as careersDelete } from "../endpoints/admin/careers/delete_POST";
import { handle as careersDeleteApplication } from "../endpoints/admin/careers/delete-application_POST";
import { handle as examContentUpsert } from "../endpoints/admin/exam-content/upsert_POST";
import { handle as examContentPublish } from "../endpoints/admin/exam-content/publish_POST";
import { handle as examContentUnpublish } from "../endpoints/admin/exam-content/unpublish_POST";
import { handle as examContentDelete } from "../endpoints/admin/exam-content/delete_POST";

type EndpointHandler = (request: Request) => Promise<Response>;

const READ_ROUTES: Record<string, EndpointHandler> = {
  "admin/blog/posts/list": blogPostsList,
  "admin/blog/posts/get": blogPostsGet,
  "admin/blog/categories/list": blogCategoriesList,
  "admin/blog/comments/list": blogCommentsList,
  "admin/news/list": newsList,
  "admin/careers/list": careersList,
  "admin/careers/applications": careersApplications,
  "admin/content/dashboard": contentDashboard,
  "admin/content-reviews/list": contentReviewsList,
  "admin/dashboard/overview": dashboardOverview,
  "admin/dashboard/trends": dashboardTrends,
  "admin/stats": adminStats,
  "admin/students/list": studentsList,
  "admin/teachers/list": teachersList,
  "admin/deleted-accounts/list": deletedAccountsList,
  "admin/orders": ordersList,
  "admin/products/list": productsList,
  "admin/courses/list": coursesList,
  "admin/tests/list": testsList,
  "admin/live-tests/list": liveTestsList,
  "admin/bundles/list": bundlesList,
  "admin/exams/list": examsList,
  "admin/exam-categories/list": examCategoriesList,
  "admin/exam-content/list": examContentList,
  "admin/subscriptions/list": subscriptionsList,
  "admin/subscription-transactions/list": subscriptionTransactionsList,
  "admin/finance/summary": financeSummary,
  "admin/earnings/list": earningsList,
  "admin/withdrawals/list": withdrawalsList,
  "admin/student-withdrawals/list": studentWithdrawalsList,
  "admin/support/threads": supportThreads,
  "admin/contact-submissions/list": contactSubmissionsList,
  "admin/inquiries": inquiriesList,
  "admin/sales/contacts": salesContacts,
};

const WRITE_ROUTES: Record<string, EndpointHandler> = {
  "admin/blog/posts/upsert": blogPostsUpsert,
  "admin/blog/posts/delete": blogPostsDelete,
  "admin/blog/categories/upsert": blogCategoriesUpsert,
  "admin/blog/categories/delete": blogCategoriesDelete,
  "admin/blog/comments/moderate": blogCommentsModerate,
  "admin/news/upsert": newsUpsert,
  "admin/news/delete": newsDelete,
  "admin/careers/create": careersCreate,
  "admin/careers/update": careersUpdate,
  "admin/careers/delete": careersDelete,
  "admin/careers/delete-application": careersDeleteApplication,
  "admin/exam-content/upsert": examContentUpsert,
  "admin/exam-content/publish": examContentPublish,
  "admin/exam-content/unpublish": examContentUnpublish,
  "admin/exam-content/delete": examContentDelete,
};

export class McpToolError extends Error {}

/** Session lifetime for the synthetic request. Long enough for one call, no more. */
const SESSION_TTL = "5m";

export async function loadAdmin(adminId: number): Promise<AdminProfile> {
  const row = await db
    .selectFrom("admins")
    .select([
      "id",
      "email",
      "fullName",
      "role",
      "avatarUrl",
      "avatarFileId",
      "bio",
      "isActive",
    ])
    .where("id", "=", adminId)
    .executeTakeFirst();

  if (!row) throw new McpToolError("The admin account for this connection no longer exists.");
  if (row.isActive === false) throw new McpToolError("This admin account is inactive.");

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    avatarUrl: row.avatarUrl,
    avatarFileId: row.avatarFileId,
    bio: row.bio,
  } as AdminProfile;
}

async function buildRequest(
  adminId: number,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<Request> {
  const admin = await loadAdmin(adminId);
  const token = await createAdminSessionToken(admin, SESSION_TTL);
  const headers: Record<string, string> = {
    cookie: `admin_session=${token}`,
    "Content-Type": "application/json",
  };
  return new Request(`${SITE_ORIGIN}/_api/${path}`, {
    method: init.method,
    headers,
    // Endpoints read the body with superjson, which expects the { json: ... } envelope.
    ...(init.body === undefined ? {} : { body: JSON.stringify({ json: init.body }) }),
  });
}

async function run(handler: EndpointHandler, request: Request, label: string): Promise<unknown> {
  const response = await handler(request);
  const payload = unwrapEndpointPayload(await response.text());
  if (!response.ok) {
    throw new McpToolError(
      `${label} failed (${response.status}): ${extractEndpointError(payload) ?? "unknown error"}`
    );
  }
  return payload;
}

export function listReadRoutes(): string[] {
  return Object.keys(READ_ROUTES).sort();
}

export async function callRead(
  adminId: number,
  path: string,
  query?: Record<string, string | number | boolean>
): Promise<unknown> {
  const handler = READ_ROUTES[path];
  if (!handler) {
    throw new McpToolError(
      `Unknown read path "${path}". Available: ${listReadRoutes().join(", ")}`
    );
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) search.append(key, String(value));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const request = await buildRequest(adminId, `${path}${suffix}`, { method: "GET" });
  return run(handler, request, path);
}

export async function callWrite(
  adminId: number,
  routeKey: string,
  body: unknown
): Promise<unknown> {
  assertMcpWritable(routeKey);
  const handler = WRITE_ROUTES[routeKey];
  if (!handler) throw new McpToolError(`No handler registered for ${routeKey}.`);
  const request = await buildRequest(adminId, routeKey, { method: "POST", body });
  return run(handler, request, routeKey);
}
