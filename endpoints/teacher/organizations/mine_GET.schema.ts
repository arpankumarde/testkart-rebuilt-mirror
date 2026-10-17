import superjson from "superjson";
import type { OrganizationTypeValue } from "./create_POST.schema";

export type MyOrganization = {
  id: string;
  name: string;
  slug: string;
  orgType: OrganizationTypeValue;
  logoUrl: string | null;
  isCreator: boolean;
  membershipStatus: "pending" | "approved" | "rejected";
  teacherCount: number;
  pendingRequestCount: number;
};

export type PendingRequest = {
  membershipId: number;
  organizationId: string;
  organizationName: string;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  requestedAt: Date;
};

export type OutputType = {
  organizations: MyOrganization[];
  pendingRequests: PendingRequest[];
};

export const getTeacherOrganizationsMine = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/organizations/mine`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
