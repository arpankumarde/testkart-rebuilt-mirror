import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType, MyOrganization, PendingRequest } from "./mine_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const memberships = await db
      .selectFrom("organizationTeachers")
      .innerJoin("organizations", "organizations.id", "organizationTeachers.organizationId")
      .select((eb) => [
        "organizations.id as organizationId",
        "organizations.name as organizationName",
        "organizations.slug as organizationSlug",
        "organizations.orgType",
        "organizations.logoUrl",
        "organizations.createdByTeacherId",
        "organizationTeachers.status",
        eb
          .selectFrom("organizationTeachers as ot2")
          .select((eb2) => eb2.fn.countAll<number>().as("count"))
          .whereRef("ot2.organizationId", "=", "organizations.id")
          .where("ot2.status", "=", "approved")
          .as("teacherCount"),
        eb
          .selectFrom("organizationTeachers as ot3")
          .select((eb3) => eb3.fn.countAll<number>().as("count"))
          .whereRef("ot3.organizationId", "=", "organizations.id")
          .where("ot3.status", "=", "pending")
          .as("pendingRequestCount"),
      ])
      .where("organizationTeachers.teacherId", "=", effectiveTeacherId)
      .orderBy("organizations.name", "asc")
      .execute();

    const organizations: MyOrganization[] = memberships.map((row) => ({
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
      orgType: row.orgType,
      logoUrl: row.logoUrl,
      isCreator: row.createdByTeacherId === effectiveTeacherId,
      membershipStatus: row.status,
      teacherCount: Number(row.teacherCount ?? 0),
      pendingRequestCount: Number(row.pendingRequestCount ?? 0),
    }));

    // Only orgs this teacher created carry approval rights - pull every
    // pending request across those, for the approvals inbox.
    const createdOrgIds = organizations.filter((o) => o.isCreator).map((o) => o.id);

    let pendingRequests: PendingRequest[] = [];
    if (createdOrgIds.length > 0) {
      const rows = await db
        .selectFrom("organizationTeachers")
        .innerJoin("organizations", "organizations.id", "organizationTeachers.organizationId")
        .innerJoin("users", "users.id", "organizationTeachers.teacherId")
        .select([
          "organizationTeachers.id as membershipId",
          "organizations.id as organizationId",
          "organizations.name as organizationName",
          "users.id as teacherId",
          "users.displayName as teacherName",
          "users.avatarUrl as teacherAvatarUrl",
          "organizationTeachers.requestedAt",
        ])
        .where("organizationTeachers.organizationId", "in", createdOrgIds)
        .where("organizationTeachers.status", "=", "pending")
        .orderBy("organizationTeachers.requestedAt", "asc")
        .execute();

      pendingRequests = rows.map((row) => ({
        membershipId: row.membershipId,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        teacherAvatarUrl: row.teacherAvatarUrl,
        requestedAt: row.requestedAt,
      }));
    }

    return new Response(
      superjson.stringify({ organizations, pendingRequests } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to load teacher's organizations:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to load organisations.", details: errorMessage }),
      { status: 500 }
    );
  }
}
