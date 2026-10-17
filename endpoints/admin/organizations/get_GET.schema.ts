import { z } from "zod";
import superjson from "superjson";
import type { OrganizationTypeValue } from "../../teacher/organizations/create_POST.schema";

export const schema = z.object({
  id: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;

export type AdminOrganizationMember = {
  membershipId: number;
  teacherId: number;
  name: string;
  email: string | null;
  slug: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isOwner: boolean;
  status: "approved" | "pending" | "rejected";
  requestedAt: Date;
  respondedAt: Date | null;
};

export type AdminOrganizationResourceKind = "course" | "bundle" | "test" | "live_test" | "product";

export type AdminOrganizationResource = {
  kind: AdminOrganizationResourceKind;
  id: number;
  title: string;
  slug: string | null;
  // List price; discountPrice is the lower price charged, when there is one.
  price: number;
  discountPrice: number | null;
  teacherName: string;
  createdAt: Date | null;
};

// Reviews are anonymous on the public page, so the admin view carries no reviewer identity either.
export type AdminOrganizationReview = {
  id: number;
  rating: number;
  reviewText: string | null;
  createdAt: Date;
};

export type AdminOrganizationPost = {
  id: number;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  teacherName: string;
  likeCount: number;
};

export type AdminOrganizationGalleryItem = {
  id: number;
  mediaType: "photo" | "video";
  url: string;
  caption: string | null;
};

export type OutputType = {
  organization: {
    id: string;
    name: string;
    slug: string;
    orgType: OrganizationTypeValue;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    location: string | null;
    phoneNumber: string | null;
    websiteUrl: string | null;
    foundedYear: number | null;
    instituteSize: string | null;
    specialties: string[];
    socialLinks: Record<string, string> | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  owner: {
    id: number;
    name: string;
    email: string | null;
    mobileNumber: string | null;
    slug: string | null;
    isActive: boolean;
  };
  members: AdminOrganizationMember[];
  resources: AdminOrganizationResource[];
  reviews: {
    count: number;
    averageRating: number | null;
    // Five entries, 5 stars down to 1.
    distribution: { stars: number; count: number }[];
    latest: AdminOrganizationReview[];
  };
  posts: AdminOrganizationPost[];
  gallery: AdminOrganizationGalleryItem[];
  followersCount: number;
};

export const getAdminOrganization = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const result = await fetch(`/_api/admin/organizations/get?id=${validated.id}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};