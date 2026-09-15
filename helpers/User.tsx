// If you need to udpate this type, make sure to also update
// components/ProtectedRoute
// endpoints/auth/login_with_password_POST
// endpoints/auth/register_with_password_POST
// endpoints/auth/session_GET
// helpers/getServerUserSession
// together with this in one toolcall.

export interface User {
  id: number;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  avatarFileId?: string | null;
  // adjust this as necessary
  role: "admin" | "teacher" | "student";
  bio?: string | null;
  websiteUrl?: string | null;
  mobileNumber?: string | null;
  mobileVerified?: boolean;
  emailVerified?: boolean;
  publicEmail?: string | null;
  publicPhone?: string | null;

  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    telegram?: string;
  } | null;
  awardsCertificates?: Array<{
    title: string;
    description?: string;
  }> | null;
  languages?: string[] | null;
  location?: string | null;
  expertiseAreas?: string[] | null;
  responseTime?: string | null;
  tagline?: string | null;
  slug?: string | null;
  onboardingCompleted?: boolean;
  isVerified?: boolean;
  instituteType?: string | null;
  academyName?: string | null;
  yearsOfExperience?: number | null;
  teacherRole?: "owner" | "manager";
  actingAsTeacherId?: number;
  teachingCategories?: string[] | null;
  targetExams?: string[] | null;
  teachingExperienceLevel?: string | null;
  currentOccupation?: string | null;
  goals?: string | null;
  discoverySource?: string | null;
  schoolCollegeName?: string | null;
  signupSource?: string | null;
}
