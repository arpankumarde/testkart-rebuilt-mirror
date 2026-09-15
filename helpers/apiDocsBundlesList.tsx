import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsBundlesList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/bundles/list",
    description: "List all published course bundles with optional filtering and sorting",
    auth: "none",
    category: "Bundles",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
      { name: "sort", type: "string", required: false, description: "'newest', 'popular', 'price_asc', or 'price_desc'" },
      { name: "teacherId", type: "number", required: false, description: "Filter by teacher ID" },
      { name: "minPrice", type: "number", required: false, description: "Minimum price filter" },
      { name: "maxPrice", type: "number", required: false, description: "Maximum price filter" },
    ],
    responseFields: [
      { name: "bundles", type: "array", description: "Array of bundle objects with item count and course titles" },
      { name: "total", type: "number", description: "Total number of matching bundles" },
      { name: "page", type: "number", description: "Current page number" },
      { name: "limit", type: "number", description: "Items per page" },
    ],
  },
  {
    method: "GET",
    route: "/_api/bundles/details",
    description: "Get detailed information about a single course bundle",
    auth: "none",
    category: "Bundles",
    queryParams: [
      { name: "slug", type: "string", required: true, description: "The unique slug of the bundle" },
    ],
    responseFields: [
      { name: "bundle", type: "object", description: "Full bundle details including all included courses and tests" },
      { name: "isEnrolled", type: "boolean", description: "Whether the authenticated student is enrolled" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
  {
    method: "POST",
    route: "/_api/bundles/purchase",
    description: "Initiate purchase flow for a course bundle",
    auth: "student",
    category: "Bundles",
    bodyParams: [
      { name: "bundleId", type: "number", required: true, description: "ID of the bundle to purchase" },
      { name: "promoCode", type: "string", required: false, description: "Optional promo code to apply" },
    ],
    responseFields: [
      { name: "orderId", type: "number", description: "Created order ID" },
      { name: "paymentUrl", type: "string", description: "URL to redirect the user to complete payment" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/bundles/enrolled",
    description: "Get all bundles the authenticated student is enrolled in",
    auth: "student",
    category: "Bundles",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "bundles", type: "array", description: "Array of enrolled bundle objects" },
      { name: "total", type: "number", description: "Total number of enrolled bundles" },
    ],
  },
];