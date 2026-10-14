import type { OrganizationTypeValue } from "../endpoints/teacher/organizations/create_POST.schema";

export const ADMIN_ORG_TYPE_LABELS: Record<OrganizationTypeValue, string> = {
  coaching: "Coaching",
  school: "School",
  college: "College",
  university: "University",
  other: "Other",
};

export const formatAdminDate = (date: Date | null | undefined): string =>
  date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "Not recorded";