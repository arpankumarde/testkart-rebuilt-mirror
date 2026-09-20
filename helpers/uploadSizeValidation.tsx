import { db } from "./db";
import { STUDY_NOTES_PDF_MAX_MB } from "./digitalProductRules";
import { assetKindForMime, isLibraryFolder, libraryMimeType } from "./teacherAssetFiles";

export const DEFAULT_UPLOAD_LIMITS = {
  thumbnailMaxMb: 3,
  profilePictureMaxMb: 2,
  kycDocumentMaxMb: 5,
  coursePdfMaxMb: 40,
  courseIntroVideoMaxMb: 50,
  lessonVideoMaxMb: 2048,
  digitalProductPdfMaxMb: 40,
  richTextImageMaxMb: 5,
};

type UploadLimitsRow = {
  thumbnailMaxMb: number;
  profilePictureMaxMb: number;
  kycDocumentMaxMb: number;
  coursePdfMaxMb: number;
  courseIntroVideoMaxMb: number;
  lessonVideoMaxMb: number;
  digitalProductPdfMaxMb: number;
  richTextImageMaxMb: number;
};

function getCategoryLimit(
  folder: string,
  contentType: string,
  limits: UploadLimitsRow
): number | null {
  const normalizedFolder = folder.replace(/^\/+/, "").replace(/\/+$/, "");

  // Library files end up as lesson videos and PDFs, so they share those limits.
  if (isLibraryFolder(normalizedFolder)) {
    if (contentType.startsWith("video/")) return limits.lessonVideoMaxMb;
    if (contentType === "application/pdf") return limits.coursePdfMaxMb;
    return null;
  }

  if (normalizedFolder.startsWith("editor-images")) {
    return limits.richTextImageMaxMb;
  }
  if (normalizedFolder.startsWith("test-thumbnail") || normalizedFolder.startsWith("course-thumbnail") || normalizedFolder.includes("thumbnail")) {
    return limits.thumbnailMaxMb;
  }
  if (normalizedFolder.startsWith("avatar") || normalizedFolder.startsWith("profile")) {
    return limits.profilePictureMaxMb;
  }
  if (normalizedFolder.startsWith("kyc") || normalizedFolder.startsWith("bank-kyc")) {
    return limits.kycDocumentMaxMb;
  }
  if (normalizedFolder.startsWith("products")) {
    return Math.min(limits.digitalProductPdfMaxMb, STUDY_NOTES_PDF_MAX_MB);
  }
  if (normalizedFolder.startsWith("course-intro")) {
    return limits.courseIntroVideoMaxMb;
  }
  if (normalizedFolder.startsWith("course")) {
    if (contentType.startsWith("video/")) {
      return limits.lessonVideoMaxMb;
    }
    if (contentType === "application/pdf") {
      return limits.coursePdfMaxMb;
    }
    if (contentType.startsWith("image/")) {
      return limits.thumbnailMaxMb;
    }
  }

  return null;
}

// Study notes files are uploaded under products/ (thumbnail folders are left out, as in
// getCategoryLimit). The asset library under library/ takes only videos and PDFs.
export function validateUploadType(folder: string, contentType: string, fileName: string): Response | null {
  const normalizedFolder = folder.replace(/^\/+/, "").replace(/\/+$/, "");
  if (isLibraryFolder(normalizedFolder)) {
    const type = contentType.toLowerCase();
    if (libraryMimeType(fileName.trim(), type) === type && assetKindForMime(type)) return null;
    return new Response(
      superjson.stringify({ error: "Only MP4, WebM or MOV videos and PDF files can be uploaded to the library." }),
      { status: 400 }
    );
  }
  if (!normalizedFolder.startsWith("products") || normalizedFolder.includes("thumbnail")) {
    return null;
  }
  if (contentType.toLowerCase() === "application/pdf" && /\.pdf$/i.test(fileName.trim())) {
    return null;
  }
  return new Response(
    superjson.stringify({ error: "Only PDF files can be uploaded for study notes." }),
    { status: 400 }
  );
}

/** The admin-set upload limits, with defaults for any value not set. */
export async function getUploadLimits(): Promise<UploadLimitsRow> {
  const limitsRow = await db
    .selectFrom("uploadLimits")
    .selectAll()
    .limit(1)
    .executeTakeFirst();

  return limitsRow
    ? {
        thumbnailMaxMb: limitsRow.thumbnailMaxMb ?? DEFAULT_UPLOAD_LIMITS.thumbnailMaxMb,
        profilePictureMaxMb: limitsRow.profilePictureMaxMb ?? DEFAULT_UPLOAD_LIMITS.profilePictureMaxMb,
        kycDocumentMaxMb: limitsRow.kycDocumentMaxMb ?? DEFAULT_UPLOAD_LIMITS.kycDocumentMaxMb,
        coursePdfMaxMb: limitsRow.coursePdfMaxMb ?? DEFAULT_UPLOAD_LIMITS.coursePdfMaxMb,
        courseIntroVideoMaxMb: limitsRow.courseIntroVideoMaxMb ?? DEFAULT_UPLOAD_LIMITS.courseIntroVideoMaxMb,
        lessonVideoMaxMb: limitsRow.lessonVideoMaxMb ?? DEFAULT_UPLOAD_LIMITS.lessonVideoMaxMb,
        digitalProductPdfMaxMb: limitsRow.digitalProductPdfMaxMb ?? DEFAULT_UPLOAD_LIMITS.digitalProductPdfMaxMb,
        richTextImageMaxMb: limitsRow.richTextImageMaxMb ?? DEFAULT_UPLOAD_LIMITS.richTextImageMaxMb,
      }
    : DEFAULT_UPLOAD_LIMITS;
}

export async function validateUploadSize(
  folder: string,
  contentType: string,
  fileSize: number
): Promise<Response | null> {
  const limits = await getUploadLimits();
  const categoryLimitMb = getCategoryLimit(folder, contentType, limits);

  if (categoryLimitMb !== null && fileSize > categoryLimitMb * 1024 * 1024) {
    return new Response(
      superjson.stringify({
        error: `File size exceeds the maximum allowed limit of ${categoryLimitMb}MB for this upload type.`,
      }),
      { status: 400 }
    );
  }

  return null;
}

import superjson from "superjson";