import { db } from "./db";
import type { OrganizationTypeValue } from "../endpoints/teacher/organizations/create_POST.schema";

export type TeacherOrganization = {
  name: string;
  slug: string;
  orgType: OrganizationTypeValue;
};

/**
 * The organisation a teacher is publicly associated with on their profile:
 * their earliest approved membership in an organisation that is still active.
 * Null when they belong to none.
 */
export async function loadTeacherOrganization(teacherId: number): Promise<TeacherOrganization | null> {
  const row = await db
    .selectFrom("organizationTeachers")
    .innerJoin("organizations", "organizations.id", "organizationTeachers.organizationId")
    .select(["organizations.name", "organizations.slug", "organizations.orgType"])
    .where("organizationTeachers.teacherId", "=", teacherId)
    .where("organizationTeachers.status", "=", "approved")
    .where("organizations.isActive", "=", true)
    .orderBy("organizationTeachers.requestedAt", "asc")
    .orderBy("organizationTeachers.id", "asc")
    .executeTakeFirst();

  return row ? { name: row.name, slug: row.slug, orgType: row.orgType as OrganizationTypeValue } : null;
}