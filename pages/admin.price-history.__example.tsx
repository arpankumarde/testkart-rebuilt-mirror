import { defineScreens, httpError, pending } from "@floot/examples";
import type { OutputType as ListOutput, PriceHistoryEntry } from "../endpoints/admin/price-history/list_GET.schema";
import type { OutputType as ProductOutput } from "../endpoints/admin/price-history/product_GET.schema";

const session = {
  admin: {
    id: 1,
    email: "catalogue@testkart.in",
    fullName: "Catalogue Admin",
    role: "admin",
    permissions: ["courses", "notes", "test_series", "live_tests", "bundles", "live_courses"],
  },
};

const at = (iso: string) => new Date(iso);

const base: Omit<PriceHistoryEntry, "id" | "previousPrice" | "newPrice" | "previousListPrice" | "newListPrice" | "changedAt"> = {
  productType: "mock_test",
  productId: "412",
  productTitle: "UGC NET Paper 1 Mock Test Series",
  teacherId: 3413,
  teacherName: "Anjali Verma",
  changeSource: "teacher",
  changedByUserId: 3413,
  changedByAdminId: null,
  changedByName: "Anjali Verma",
};

const ugcNet: PriceHistoryEntry[] = [
  { ...base, id: 9, previousPrice: 199, newPrice: 149, previousListPrice: 199, newListPrice: 149, changedAt: at("2026-11-18T09:12:00Z") },
  { ...base, id: 5, previousPrice: 149, newPrice: 199, previousListPrice: 149, newListPrice: 199, changedAt: at("2026-11-14T06:40:00Z") },
  { ...base, id: 2, previousPrice: 99, newPrice: 149, previousListPrice: 99, newListPrice: 149, changedAt: at("2026-11-10T11:05:00Z") },
];

const items: PriceHistoryEntry[] = [
  ugcNet[0],
  {
    id: 8, productType: "digital_product", productId: "87", productTitle: "Bihar SLET Sanjeevani Buti Complete Notes",
    teacherId: 2201, teacherName: "Barun Kumar", previousPrice: 0, newPrice: 49, previousListPrice: 0, newListPrice: 49,
    changeSource: "team_member", changedByUserId: 2290, changedByAdminId: null, changedByName: "Ravi (team)", changedAt: at("2026-11-17T15:30:00Z"),
  },
  {
    id: 7, productType: "course", productId: "31", productTitle: "CTET Child Development and Pedagogy Full Course",
    teacherId: 1880, teacherName: "Maths exam hub TGT and PGT", previousPrice: 1499, newPrice: 0, previousListPrice: 1499, newListPrice: 0,
    changeSource: "teacher", changedByUserId: 1880, changedByAdminId: null, changedByName: "Maths exam hub TGT and PGT", changedAt: at("2026-11-16T08:02:00Z"),
  },
  {
    id: 6, productType: "course_bundle", productId: "14", productTitle: "SSC CGL Tier 1 Complete Bundle",
    teacherId: 2201, teacherName: "Barun Kumar", previousPrice: 799, newPrice: 649.5, previousListPrice: null, newListPrice: null,
    changeSource: "admin_editor", changedByUserId: 2201, changedByAdminId: 1, changedByName: "Catalogue Admin (admin)", changedAt: at("2026-11-15T12:44:00Z"),
  },
  {
    id: 4, productType: "live_course", productId: "8a7bc8cf-a05b-414e-8f8b-55dad9f4bc00", productTitle: "Railway NTPC 8-week Live Batch",
    teacherId: 3001, teacherName: "Sharma Classes", previousPrice: 2999, newPrice: 2999, previousListPrice: 4999, newListPrice: 3999,
    changeSource: "teacher", changedByUserId: 3001, changedByAdminId: null, changedByName: "Sharma Classes", changedAt: at("2026-11-12T04:20:00Z"),
  },
  ugcNet[1],
  ugcNet[2],
];

const list: ListOutput = {
  items,
  total: items.length,
  page: 1,
  totalPages: 1,
  productTypes: ["mock_test", "course", "digital_product", "course_bundle", "live_test", "live_course"],
  teachers: [
    { id: 3413, name: "Anjali Verma", count: 3 },
    { id: 2201, name: "Barun Kumar", count: 2 },
    { id: 1880, name: "Maths exam hub TGT and PGT", count: 1 },
    { id: 3001, name: "Sharma Classes", count: 1 },
  ],
};

const product: ProductOutput = {
  product: {
    exists: true,
    title: "UGC NET Paper 1 Mock Test Series",
    status: "published",
    teacherId: 3413,
    teacherName: "Anjali Verma",
    currentPrice: 149,
    currentListPrice: 149,
  },
  entries: ugcNet,
};

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
    "admin/price-history/product_GET": product,
  },
  screens: [
    { title: "Loaded", backend: { "admin/price-history/list_GET": list } },
    {
      title: "No matches",
      route: "/admin/price-history?type=live_test",
      backend: { "admin/price-history/list_GET": { ...list, items: [], total: 0 } },
    },
    {
      title: "Nothing recorded yet",
      backend: { "admin/price-history/list_GET": { ...list, items: [], total: 0, teachers: [] } },
    },
    { title: "Loading", backend: { "admin/price-history/list_GET": pending } },
    { title: "Load failed", backend: { "admin/price-history/list_GET": httpError(500) } },
  ],
});
