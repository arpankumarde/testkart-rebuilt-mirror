import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsUserMisc: ApiEndpoint[] = [
  // ─── Student Profile & Wallet ────────────────────────────────────────────────
  {
    method: "POST",
    route: "/_api/student/profile/update",
    description: "Update the authenticated student's profile information",
    auth: "student",
    category: "Student Profile & Wallet",
    bodyParams: [
      { name: "displayName", type: "string", required: false, description: "Updated display name" },
      { name: "bio", type: "string", required: false, description: "Updated bio" },
      { name: "avatarUrl", type: "string", required: false, description: "Updated avatar URL" },
      { name: "location", type: "string", required: false, description: "Updated location" },
    ],
    responseFields: [
      { name: "user", type: "object", description: "Updated user object" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/wallet/balance",
    description: "Get the authenticated student's wallet balance",
    auth: "student",
    category: "Student Profile & Wallet",
    responseFields: [
      { name: "balance", type: "number", description: "Current wallet balance" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/wallet/transactions",
    description: "Get the wallet transaction history for the authenticated student",
    auth: "student",
    category: "Student Profile & Wallet",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" },
    ],
    responseFields: [
      { name: "transactions", type: "array", description: "Array of wallet transaction objects" },
      { name: "total", type: "number", description: "Total number of transactions" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/wallet/purchase",
    description: "Purchase an item using the student's wallet balance",
    auth: "student",
    category: "Student Profile & Wallet",
    bodyParams: [
      { name: "orderId", type: "number", required: true, description: "ID of the order to pay for using wallet" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the purchase was successful" },
      { name: "newBalance", type: "number", description: "Updated wallet balance after the purchase" },
      { name: "error", type: "string", description: "Error message on failure (e.g. insufficient balance)" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/bank-details",
    description: "Get the authenticated student's saved bank details",
    auth: "student",
    category: "Student Profile & Wallet",
    responseFields: [
      { name: "bankDetails", type: "object", description: "Bank details including account number, IFSC, and verification status" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/bank-details/add",
    description: "Add or update bank details for the authenticated student",
    auth: "student",
    category: "Student Profile & Wallet",
    bodyParams: [
      { name: "bankName", type: "string", required: true, description: "Name of the bank" },
      { name: "bankAccountNumber", type: "string", required: true, description: "Bank account number" },
      { name: "bankIfscCode", type: "string", required: true, description: "IFSC code of the bank branch" },
      { name: "bankAccountHolderName", type: "string", required: true, description: "Account holder's name" },
      { name: "panNumber", type: "string", required: true, description: "PAN card number" },
      { name: "upiId", type: "string", required: false, description: "UPI ID (optional)" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if bank details were saved" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/withdrawal/list",
    description: "Get the withdrawal request history for the authenticated student",
    auth: "student",
    category: "Student Profile & Wallet",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "withdrawals", type: "array", description: "Array of withdrawal request objects with status" },
      { name: "total", type: "number", description: "Total number of withdrawal requests" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/withdrawal/request",
    description: "Submit a withdrawal request for the authenticated student's wallet balance",
    auth: "student",
    category: "Student Profile & Wallet",
    bodyParams: [
      { name: "amount", type: "number", required: true, description: "Amount to withdraw" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the withdrawal request was submitted" },
      { name: "withdrawalId", type: "number", description: "ID of the created withdrawal request" },
      { name: "error", type: "string", description: "Error message on failure (e.g. insufficient balance)" },
    ],
    notes: ["Requires the student to have verified bank details on file"],
  },

  // ─── Certificates ─────────────────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/student/certificates/list",
    description: "Get all certificates earned by the authenticated student",
    auth: "student",
    category: "Certificates",
    responseFields: [
      { name: "certificates", type: "array", description: "Array of certificate objects with type and details" },
      { name: "total", type: "number", description: "Total number of certificates" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/certificate/generate",
    description: "Generate a completion certificate for a course or test",
    auth: "student",
    category: "Certificates",
    bodyParams: [
      { name: "courseId", type: "number", required: false, description: "ID of the completed course (one of courseId or testItemId is required)" },
      { name: "testItemId", type: "number", required: false, description: "ID of the completed test item" },
    ],
    responseFields: [
      { name: "certificateId", type: "number", description: "ID of the generated certificate" },
      { name: "certificateNumber", type: "string", description: "Unique public certificate number" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/certificate/download",
    description: "Get a download URL for a student's certificate PDF",
    auth: "student",
    category: "Certificates",
    bodyParams: [
      { name: "certificateId", type: "number", required: true, description: "ID of the certificate to download" },
    ],
    responseFields: [
      { name: "downloadUrl", type: "string", description: "URL to download the certificate PDF" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/certificate/public",
    description: "Publicly verify and view a certificate by its certificate number",
    auth: "none",
    category: "Certificates",
    queryParams: [
      { name: "certificateNumber", type: "string", required: true, description: "The unique certificate number to look up" },
    ],
    responseFields: [
      { name: "certificate", type: "object", description: "Certificate details including student name, course/test, and completion date" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },

  // ─── Reviews ──────────────────────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/reviews/list",
    description: "Get published reviews for a specific mock test or digital product",
    auth: "none",
    category: "Reviews",
    queryParams: [
      { name: "mockTestId", type: "number", required: false, description: "ID of the mock test to fetch reviews for" },
      { name: "digitalProductId", type: "number", required: false, description: "ID of the digital product to fetch reviews for" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "reviews", type: "array", description: "Array of review objects with rating and text" },
      { name: "averageRating", type: "number", description: "Average rating across all reviews" },
      { name: "total", type: "number", description: "Total number of reviews" },
    ],
  },
  {
    method: "POST",
    route: "/_api/reviews/submit",
    description: "Submit a review for a mock test or digital product",
    auth: "student",
    category: "Reviews",
    bodyParams: [
      { name: "mockTestId", type: "number", required: false, description: "ID of the mock test to review (one of mockTestId or digitalProductId is required)" },
      { name: "digitalProductId", type: "number", required: false, description: "ID of the digital product to review" },
      { name: "rating", type: "number", required: true, description: "Rating from 1 to 5" },
      { name: "reviewText", type: "string", required: false, description: "Optional written review" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the review was submitted" },
      { name: "reviewId", type: "number", description: "ID of the created review" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
    notes: ["Requires the student to have purchased the item being reviewed"],
  },

  // ─── Teachers (Public) ────────────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/teachers/avatars",
    description: "Get avatar URLs for a list of teacher user IDs",
    auth: "none",
    category: "Teachers (Public)",
    queryParams: [
      { name: "ids", type: "string", required: true, description: "Comma-separated list of teacher user IDs" },
    ],
    responseFields: [
      { name: "avatars", type: "object", description: "Map of teacher ID to avatar URL" },
    ],
  },
  {
    method: "GET",
    route: "/_api/teachers/profile",
    description: "Get the public profile of a teacher",
    auth: "none",
    category: "Teachers (Public)",
    queryParams: [
      { name: "teacherId", type: "number", required: true, description: "ID of the teacher" },
    ],
    responseFields: [
      { name: "teacher", type: "object", description: "Public teacher profile including bio, social links, courses, and tests" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },

  // ─── Homepage & Misc ──────────────────────────────────────────────────────────
  {
    method: "GET",
    route: "/_api/homepage/data",
    description: "Get all data needed to render the homepage",
    auth: "none",
    category: "Homepage & Misc",
    responseFields: [
      { name: "featuredTests", type: "array", description: "Featured mock test packages for the homepage" },
      { name: "featuredCourses", type: "array", description: "Featured courses for the homepage" },
      { name: "popularExams", type: "array", description: "Popular exam categories with test counts" },
      { name: "liveTests", type: "array", description: "Upcoming and live tests" },
    ],
  },
  {
    method: "POST",
    route: "/_api/contact/submit",
    description: "Submit a contact form enquiry",
    auth: "none",
    category: "Homepage & Misc",
    bodyParams: [
      { name: "name", type: "string", required: true, description: "Sender's name" },
      { name: "email", type: "string", required: true, description: "Sender's email address" },
      { name: "subject", type: "string", required: false, description: "Subject of the enquiry" },
      { name: "message", type: "string", required: true, description: "The enquiry message" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the submission was received" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/static-page",
    description: "Get the content of a static page (e.g. About, Terms, Privacy)",
    auth: "none",
    category: "Homepage & Misc",
    queryParams: [
      { name: "slug", type: "string", required: true, description: "The slug of the static page (e.g. 'about-us', 'terms-of-service')" },
    ],
    responseFields: [
      { name: "page", type: "object", description: "Static page object with title and HTML content" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
];