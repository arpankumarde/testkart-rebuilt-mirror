/**
 * This helper file defines shared TypeScript interfaces for teacher profile data.
 * It serves as a single source of truth for the structure of a teacher's public-facing
 * profile information, ensuring type consistency across different parts of the application,
 * such as the teacher's public profile page and the profile editing form.
 */

/**
 * Represents the structure for social media links.
 * All properties are optional.
 */
export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
}

/**
 * Represents a single award or certificate.
 * The title is required, but the description is optional.
 */
export interface AwardCertificate {
  title: string;
  description?: string;
}

/**
 * Represents a single work experience entry.
 */
export interface WorkExperience {
  id: number;
  companyName: string;
  position: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
  location: string | null;
}

/**
 * Represents the complete public profile of a teacher.
 * This interface aggregates all the necessary information to be displayed
 * on a teacher's public profile page.
 */
export interface TeacherPublicProfile {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  /**
   * No mobileNumber / publicEmail / publicPhone here on purpose. This shape is
   * served by the PUBLIC, unauthenticated teachers/profile endpoint, so any
   * field on it is readable by anyone - a teacher's contact details are not
   * published. Reach them through Testkart, or through the links they chose to
   * share (websiteUrl, socialLinks).
   */
  socialLinks?: SocialLinks | null;
  awardsCertificates?: AwardCertificate[] | null;
  languages?: string[] | null;
  location?: string | null;
  expertiseAreas?: (string | { examId: number; examName: string })[] | null;
  responseTime?: string | null;
  tagline?: string | null;
  slug?: string | null;
  isVerified?: boolean;
  workExperiences?: WorkExperience[] | null;
  /**
   * Added for the public landing page's credibility strip. Additive only -
   * the shipped mobile app reads this same payload and pins the surface, so
   * fields here may be added but never renamed or removed.
   */
  academyName?: string | null;
  yearsOfExperience?: number | null;
  joinedAt?: Date | null;
}