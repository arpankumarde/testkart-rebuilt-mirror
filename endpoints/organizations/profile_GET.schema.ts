import { z } from "zod";
import superjson from "superjson";
import type { OrganizationTypeValue } from "../teacher/organizations/create_POST.schema";
import type { OrganizationSocialLinks, InstituteSizeValue } from "../teacher/organizations/update_POST.schema";
import type { OrganizationGalleryItem } from "../teacher/organizations/gallery/list_GET.schema";

export const schema = z.object({
  orgSlug: z.string(),
});

export type InputType = z.infer<typeof schema>;

export type OrganizationTeacherCard = {
  id: number;
  slug: string | null;
  displayName: string;
  avatarUrl: string | null;
  tagline: string | null;
  isVerified: boolean;
  yearsOfExperience: number | null;
  // From the teacher's profile expertise areas.
  subjects: string[];
  // Average and count of student reviews across the teacher's own courses,
  // study notes and mock tests; null when nothing has been reviewed.
  rating: number | null;
  ratingCount: number;
};

export type OrgCatalogueKind = "course" | "test" | "live_test" | "product" | "bundle";

export type OrgCatalogueItem = {
  kind: OrgCatalogueKind;
  id: number;
  slug: string;
  title: string;
  examName: string | null;
  // List price. discountPrice, when set, is the lower price actually charged.
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  pageCount: number | null;
  rating: number | null;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
  teacherIsVerified: boolean;
};

export type OrganizationPost = {
  id: number;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
};

export type OutputType = {
  organization: {
    id: number;
    name: string;
    slug: string;
    orgType: OrganizationTypeValue;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    location: string | null;
    websiteUrl: string | null;
    phoneNumber: string | null;
    createdAt: Date;
    foundedYear: number | null;
    instituteSize: InstituteSizeValue | null;
    specialties: string[];
    socialLinks: OrganizationSocialLinks | null;
  };
  teachers: OrganizationTeacherCard[];
  catalogue: OrgCatalogueItem[];
  posts: OrganizationPost[];
  gallery: OrganizationGalleryItem[];
  followerCount: number;
  isFollowing: boolean;
  reviewCount: number;
  averageRating: number | null;
};

export const getOrganizationsProfile = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({ orgSlug: validatedInput.orgSlug });
  const result = await fetch(`/_api/organizations/profile?${params.toString()}`, {
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
