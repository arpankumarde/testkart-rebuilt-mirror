import { defineScreens, httpError, pending } from "@floot/examples";
import type { OutputType as SearchOutput, AdminOrderRow } from "../endpoints/admin/orders/search_POST.schema";
import type { OutputType as SummaryOutput } from "../endpoints/admin/orders/summary_POST.schema";
import type { OutputType as FacetsOutput } from "../endpoints/admin/orders/facets_GET.schema";
import type { OutputType as SubscriptionList } from "../endpoints/admin/subscription-transactions/list_GET.schema";

const session = {
  admin: { id: 1, email: "finance@testkart.in", fullName: "Finance Admin", role: "admin", permissions: ["transactions", "finance"] },
};

const at = (iso: string) => new Date(iso);

const base: Omit<AdminOrderRow, "id" | "client"> = {
  createdAt: at("2026-11-09T16:07:00Z"),
  paidAt: at("2026-11-09T16:08:10Z"),
  studentId: 100,
  studentName: "Krishna Kumar",
  studentEmail: "krishna@example.com",
  studentPhone: "9953400000",
  isSponsored: false,
  teacherId: 3413,
  teacherName: "Maths exam hub TGT and PGT",
  purchasedItems: "Statics and Dynamics Maths Notes",
  purchasedItemDetails: [{ title: "Statics and Dynamics Maths Notes", type: "product", url: "/study-notes/statics" }],
  totalAmount: 99,
  discountAmount: 0,
  tcoinsRedeemed: 0,
  status: "completed",
  paymentMethod: "payu",
  paymentMode: "UPI",
  paymentTransactionId: "testkart-pEbQIJXcVTsW",
  invoiceNumber: "TK/26-27/0931",
  promoCodeId: null,
  promoCode: null,
  refundedAt: null,
  refundReason: null,
  paymentFailure: null,
};

const rows: AdminOrderRow[] = [
  {
    ...base,
    id: 5559,
    client: {
      source: "android_app", platform: "android_app", deviceType: "mobile", osName: "Android", osVersion: "16",
      browserName: null, browserVersion: null, deviceBrand: "Samsung", deviceModel: "SM-S911B", appVersion: "4.13.0 (73)",
      screen: "1080x2340", referrer: null, userAgent: "okhttp/4.12.0", ip: "49.36.10.1",
    },
  },
  {
    ...base,
    id: 5558,
    studentName: "Murari Lal",
    totalAmount: 134.1,
    discountAmount: 14.9,
    promoCode: "DIWALI-MAHOTSAV",
    paymentMode: "CC",
    teacherName: "Barun kumar, Notes",
    purchasedItemDetails: [
      { title: "Sanjeevani Buti Bihar SLET Notes", type: "product", url: "/study-notes/x" },
      { title: "Bihar SLET Mock Test Series", type: "test", url: "/mock-test/y" },
    ],
    client: {
      source: "web", platform: "mobile_web", deviceType: "mobile", osName: "iOS", osVersion: "26.5",
      browserName: "Safari", browserVersion: "26", deviceBrand: "Apple", deviceModel: "iPhone", appVersion: null,
      screen: "1170x2532", referrer: "instagram.com", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)", ip: "106.21.1.2",
    },
  },
  {
    ...base,
    id: 5557,
    status: "cancelled",
    paidAt: null,
    paymentMode: null,
    invoiceNumber: null,
    studentName: "Priyanka Singh",
    client: {
      source: "web", platform: "desktop_web", deviceType: "desktop", osName: "Windows", osVersion: "11",
      browserName: "Chrome", browserVersion: "157", deviceBrand: null, deviceModel: null, appVersion: null,
      screen: "1920x1080", referrer: "google.com", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ip: "103.1.1.1",
    },
  },
  {
    ...base,
    id: 5390,
    createdAt: at("2026-11-02T08:15:00Z"),
    paidAt: null,
    paymentMode: null,
    status: "pending",
    invoiceNumber: null,
    studentName: "Aman Verma",
    client: null,
  },
];

const search: SearchOutput = { rows, total: 5389, page: 1, pageSize: 50, reconcilable: 7 };

const summary: SummaryOutput = {
  totals: { orders: 5389, completed: 3972, revenue: 159544.74, pending: 7, failed: 589, cancelled: 813, refunded: 8, refundedAmount: 1171, attributed: 166 },
  breakdown: "platform",
  rows: [
    { key: "unknown", label: "Not captured", orders: 5223, completed: 3854, revenue: 153750.79 },
    { key: "mobile_web", label: "Mobile web", orders: 92, completed: 68, revenue: 1321.5 },
    { key: "desktop_web", label: "Desktop web", orders: 40, completed: 34, revenue: 3977.45 },
    { key: "android_app", label: "Android app", orders: 32, completed: 14, revenue: 495 },
    { key: "tablet_web", label: "Tablet web", orders: 2, completed: 2, revenue: 0 },
  ],
};

const facets: FacetsOutput = {
  osNames: [{ value: null, count: 5224 }, { value: "Android", count: 119 }, { value: "Windows", count: 29 }, { value: "iOS", count: 6 }],
  browsers: [{ value: null, count: 5256 }, { value: "Chrome", count: 120 }, { value: "Safari", count: 4 }],
  brands: [{ value: null, count: 5366 }, { value: "Apple", count: 11 }, { value: "Xiaomi", count: 7 }],
  paymentMethods: [{ value: "payu", count: 2347 }, { value: null, count: 2149 }, { value: "free", count: 879 }],
  teachers: [{ id: 3413, name: "Comsphere Academy", count: 497 }],
  promoCodes: [{ code: "GAHLOT100", count: 9 }],
};

const desktopClient = {
  source: "web" as const, platform: "desktop_web" as const, deviceType: "desktop" as const, osName: "Windows", osVersion: "11",
  browserName: "Chrome", browserVersion: "157", deviceBrand: null, deviceModel: null, appVersion: null,
  screen: "1920x1080", referrer: "google.com", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ip: "103.1.1.1",
};

const subscriptions: SubscriptionList = [
  {
    id: 171, transactionDate: at("2026-12-09T05:30:00Z"), teacherName: "Comsphere Academy", teacherEmail: "owner@comsphere.in",
    planName: "Starter Monthly", amount: 499, status: "completed", paymentMethod: "payu_recurring", transactionId: "testkart-chg-9aK2",
    invoiceNumber: "TK/SUB/0042", paymentFailure: null, client: desktopClient, clientInheritedFrom: 162,
  },
  {
    id: 165, transactionDate: at("2026-11-12T10:12:00Z"), teacherName: "Maths exam hub", teacherEmail: "hub@example.com",
    planName: "Individual Monthly", amount: 999, status: "completed", paymentMethod: "payu", transactionId: "testkart-sub-x81",
    invoiceNumber: "TK/SUB/0041", paymentFailure: null, clientInheritedFrom: null,
    client: {
      source: "web", platform: "mobile_web", deviceType: "mobile", osName: "Android", osVersion: "14",
      browserName: "Chrome", browserVersion: "157", deviceBrand: "Samsung", deviceModel: "SM-A546E", appVersion: null,
      screen: "1080x2340", referrer: null, userAgent: "Mozilla/5.0 (Linux; Android 10; K)", ip: "49.36.2.2",
    },
  },
  {
    id: 162, transactionDate: at("2026-11-09T18:40:00Z"), teacherName: "Comsphere Academy", teacherEmail: "owner@comsphere.in",
    planName: "Starter Monthly", amount: 1, status: "completed", paymentMethod: "payu_recurring", transactionId: "testkart-mnd-77Q",
    invoiceNumber: "TK/SUB/0040", paymentFailure: null, client: desktopClient, clientInheritedFrom: null,
  },
  {
    id: 160, transactionDate: at("2026-11-02T08:00:00Z"), teacherName: "Barun kumar", teacherEmail: "barun@example.com",
    planName: "Starter Monthly", amount: 499, status: "failed", paymentMethod: "payu_recurring", transactionId: "testkart-chg-2bb",
    invoiceNumber: null, paymentFailure: null, client: null, clientInheritedFrom: null,
  },
];

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
    "admin/orders/facets_GET": facets,
  },
  screens: [
    {
      title: "Loaded",
      backend: { "admin/orders/search_POST": search, "admin/orders/summary_POST": summary },
    },
    {
      title: "Filtered",
      route: "/admin/transactions?platform=android_app,mobile_web&status=completed&range=30d&browser=Chrome&os=Android",
      backend: { "admin/orders/search_POST": { ...search, total: 82 }, "admin/orders/summary_POST": summary },
    },
    {
      title: "No matches",
      route: "/admin/transactions?platform=ios_app",
      backend: {
        "admin/orders/search_POST": { rows: [], total: 0, page: 1, pageSize: 50, reconcilable: 0 },
        "admin/orders/summary_POST": { ...summary, totals: { ...summary.totals, orders: 0, completed: 0, revenue: 0, attributed: 0 }, rows: [] },
      },
    },
    { title: "Loading", backend: { "admin/orders/search_POST": pending, "admin/orders/summary_POST": pending } },
    { title: "Load failed", backend: { "admin/orders/search_POST": httpError(500), "admin/orders/summary_POST": httpError(500) } },
    {
      title: "Subscription payments",
      route: "/admin/transactions?view=subscription",
      backend: { "admin/subscription-transactions/list_GET": subscriptions },
    },
    {
      title: "Subscription payments filtered",
      route: "/admin/transactions?view=subscription&splatform=desktop_web&sstatus=completed",
      backend: { "admin/subscription-transactions/list_GET": subscriptions },
    },
  ],
});
