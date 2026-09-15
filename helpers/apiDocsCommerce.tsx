import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsCommerce: ApiEndpoint[] = [
  // ─── Digital Products (Shop) ─────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/shop/list",
    description: "List published digital products with optional filtering and sorting",
    auth: "none",
    category: "Digital Products",
    queryParams: [
      { name: "category", type: "string", required: false, description: "Filter by category" },
      { name: "priceMin", type: "number", required: false, description: "Minimum price filter" },
      { name: "priceMax", type: "number", required: false, description: "Maximum price filter" },
      { name: "language", type: "string", required: false, description: "Filter by language" },
      { name: "search", type: "string", required: false, description: "Search across title and description" },
      { name: "sort", type: "string", required: false, description: "'newest', 'popular', 'price_asc', or 'price_desc'" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" },
    ],
    responseFields: [
      { name: "products", type: "array", description: "Array of digital product objects" },
      { name: "totalCount", type: "number", description: "Total number of matching products" },
      { name: "totalPages", type: "number", description: "Total number of pages" },
      { name: "page", type: "number", description: "Current page number" },
    ],
  },
  {
    method: "GET",
    route: "/_api/shop/details",
    description: "Get detailed information about a single digital product",
    auth: "none",
    category: "Digital Products",
    queryParams: [
      { name: "slug", type: "string", required: true, description: "The unique slug of the digital product" },
    ],
    responseFields: [
      { name: "product", type: "object", description: "Full product details including description, tags, and preview pages" },
      { name: "hasPurchased", type: "boolean", description: "Whether the authenticated student has purchased this product" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
  {
    method: "POST",
    route: "/_api/shop/enroll-free",
    description: "Claim a free digital product for the authenticated student",
    auth: "student",
    category: "Digital Products",
    bodyParams: [
      { name: "productId", type: "number", required: true, description: "ID of the free digital product" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the product was claimed successfully" },
      { name: "purchaseId", type: "number", description: "ID of the new purchase record" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/shop/purchases",
    description: "Get all digital products purchased by the authenticated student",
    auth: "student",
    category: "Digital Products",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" },
    ],
    responseFields: [
      { name: "purchases", type: "array", description: "Array of purchased product objects with download count" },
      { name: "total", type: "number", description: "Total number of purchased products" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/shop/download",
    description: "Get a signed download URL for a purchased digital product",
    auth: "student",
    category: "Digital Products",
    bodyParams: [
      { name: "productId", type: "number", required: true, description: "ID of the purchased digital product" },
    ],
    responseFields: [
      { name: "downloadUrl", type: "string", description: "Signed URL to download the product PDF" },
      { name: "expiresAt", type: "Date", description: "Expiry timestamp of the download URL" },
    ],
    notes: ["Increments the download counter for the purchase record"],
  },

  // ─── Cart & Orders ────────────────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/cart/items",
    description: "Get all items in the authenticated user's shopping cart",
    auth: "any",
    category: "Cart & Orders",
    responseFields: [
      { name: "items", type: "array", description: "Array of cart items with type ('test', 'course', 'digitalProduct') and details" },
    ],
  },
  {
    method: "POST",
    route: "/_api/cart/add",
    description: "Add an item to the authenticated user's shopping cart",
    auth: "any",
    category: "Cart & Orders",
    bodyParams: [
      { name: "mockTestId", type: "number", required: false, description: "ID of the mock test to add (one of mockTestId, courseId, or digitalProductId is required)" },
      { name: "courseId", type: "number", required: false, description: "ID of the course to add" },
      { name: "digitalProductId", type: "number", required: false, description: "ID of the digital product to add" },
    ],
    responseFields: [
      { name: "cartItemId", type: "number", description: "ID of the newly added cart item" },
      { name: "error", type: "string", description: "Error message on failure (e.g. already in cart)" },
    ],
  },
  {
    method: "POST",
    route: "/_api/cart/remove",
    description: "Remove an item from the authenticated user's shopping cart",
    auth: "any",
    category: "Cart & Orders",
    bodyParams: [
      { name: "cartItemId", type: "number", required: true, description: "ID of the cart item to remove" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the item was removed successfully" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/orders/create",
    description: "Create an order from the current cart contents",
    auth: "any",
    category: "Cart & Orders",
    bodyParams: [
      { name: "promoCode", type: "string", required: false, description: "Optional promo code to apply to the order" },
    ],
    responseFields: [
      { name: "orderId", type: "number", description: "ID of the created order" },
      { name: "totalAmount", type: "number", description: "Total amount due for the order" },
      { name: "paymentUrl", type: "string", description: "URL to redirect to for payment (for paid orders)" },
    ],
  },
  {
    method: "GET",
    route: "/_api/orders/list",
    description: "Get the order history for the authenticated user",
    auth: "any",
    category: "Cart & Orders",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "orders", type: "array", description: "Array of order objects with status and items" },
      { name: "total", type: "number", description: "Total number of orders" },
    ],
  },
  {
    method: "GET",
    route: "/_api/orders/details",
    description: "Get details for a specific order",
    auth: "any",
    category: "Cart & Orders",
    queryParams: [
      { name: "orderId", type: "number", required: true, description: "ID of the order" },
    ],
    responseFields: [
      { name: "order", type: "object", description: "Full order details including all items and payment info" },
      { name: "error", type: "string", description: "Error message if not found or unauthorized" },
    ],
  },

  // ─── Payments ─────────────────────────────────────────────────────────────────
  {
    method: "POST",
    route: "/_api/payment/payu/initiate",
    description: "Initiate a PayU payment for an order",
    auth: "any",
    category: "Payments",
    bodyParams: [
      { name: "orderId", type: "number", required: true, description: "ID of the order to pay for" },
    ],
    responseFields: [
      { name: "payuFormData", type: "object", description: "Form fields required to submit to PayU payment gateway" },
      { name: "payuUrl", type: "string", description: "PayU payment gateway URL to POST the form to" },
    ],
  },
  {
    method: "POST",
    route: "/_api/payment/payu/callback",
    description: "Handle the PayU payment callback after a transaction attempt",
    auth: "none",
    category: "Payments",
    bodyParams: [
      { name: "txnid", type: "string", required: true, description: "Transaction ID from PayU" },
      { name: "status", type: "string", required: true, description: "Payment status from PayU (success, failure, etc.)" },
      { name: "hash", type: "string", required: true, description: "Security hash from PayU for verification" },
    ],
    responseFields: [
      { name: "redirectUrl", type: "string", description: "URL to redirect the browser to after processing" },
    ],
    notes: ["This endpoint is called by PayU directly and performs server-side hash verification"],
  },
  {
    method: "POST",
    route: "/_api/payment/payu/verify-and-complete",
    description: "Verify a PayU transaction and mark the order as complete",
    auth: "any",
    category: "Payments",
    bodyParams: [
      { name: "orderId", type: "number", required: true, description: "ID of the order to verify" },
      { name: "transactionId", type: "string", required: true, description: "PayU transaction ID to verify" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if payment was verified and order completed" },
      { name: "order", type: "object", description: "Updated order object" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/payment/payu/verify-pending",
    description: "Verify and resolve any pending payment transactions",
    auth: "any",
    category: "Payments",
    bodyParams: [
      { name: "orderId", type: "number", required: true, description: "ID of the pending order to check" },
    ],
    responseFields: [
      { name: "status", type: "string", description: "Resolved payment status ('completed', 'failed', or 'pending')" },
      { name: "order", type: "object", description: "Updated order object if resolved" },
    ],
  },

  // ─── Promo Codes ──────────────────────────────────────────────────────────────
  {
    method: "POST",
    route: "/_api/promo-codes/validate",
    description: "Validate a promo code and calculate the discount",
    auth: "any",
    category: "Promo Codes",
    bodyParams: [
      { name: "code", type: "string", required: true, description: "The promo code to validate" },
      { name: "cartTotal", type: "number", required: true, description: "The total cart value to apply the discount to" },
      { name: "itemIds", type: "array", required: false, description: "Array of item IDs in the cart (for targeted promo codes)" },
    ],
    responseFields: [
      { name: "isValid", type: "boolean", description: "True if the promo code is valid and applicable" },
      { name: "discountAmount", type: "number", description: "Calculated discount amount" },
      { name: "discountType", type: "string", description: "'fixed' or 'percentage'" },
      { name: "error", type: "string", description: "Reason the code is invalid (e.g. expired, usage limit reached)" },
    ],
  },
];