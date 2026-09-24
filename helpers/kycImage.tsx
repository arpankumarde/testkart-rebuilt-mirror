import { nanoid } from "nanoid";
import { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./_publicConfigs";
import { getObjectUrl, isPrivateKey, r2ObjectExists, uploadToR2 } from "./r2Client";

/*
 * PAN card images. The bank-details tables store the R2 key (kyc/...), which the public domain
 * refuses to serve, and every reader turns it into a signed link that expires in minutes. A
 * legacy https://cdn.testkart.in/kyc/... value is still accepted and resolves to the same key.
 */

export type KycOwnerKind = "teacher" | "student";

export const kycFolder = (kind: KycOwnerKind): string => `kyc/${kind}s`;

const ownerPrefix = (kind: KycOwnerKind, ownerId: number): string => `${kycFolder(kind)}/${ownerId}/`;

const PATH_STYLE_HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const VIRTUAL_HOSTED_HOST = `${R2_BUCKET_NAME}.${PATH_STYLE_HOST}`;

/** The upload key for a new PAN image, under the owner's own prefix. */
export const newKycKey = (kind: KycOwnerKind, ownerId: number, ext: string | null): string =>
  `${ownerPrefix(kind, ownerId)}${nanoid(16)}${ext ? `.${ext}` : ""}`;

/** The kind of PAN image a folder holds, or null when it is not a PAN image folder. */
export const kycKindForFolder = (folder: string): KycOwnerKind | null =>
  folder === kycFolder("teacher") ? "teacher" : folder === kycFolder("student") ? "student" : null;

/**
 * The R2 key behind a stored or submitted PAN image value: a bare key, a signed R2 link or a
 * legacy public CDN link. Null for anything else.
 */
export function kycKeyFromValue(value: string): string | null {
  let key: string | null = null;
  if (isPrivateKey(value)) {
    key = value;
  } else {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;
    let path: string;
    try {
      path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch {
      return null;
    }
    if (url.hostname === R2_PUBLIC_URL || url.hostname === VIRTUAL_HOSTED_HOST) {
      key = path;
    } else if (url.hostname === PATH_STYLE_HOST && path.startsWith(`${R2_BUCKET_NAME}/`)) {
      key = path.slice(R2_BUCKET_NAME.length + 1);
    }
  }
  if (!key || !isPrivateKey(key) || key.split("/").some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }
  return key;
}

/** The link a client may show for a stored PAN image; empty when there is none. */
export async function kycImageUrl(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  if (isPrivateKey(stored)) return getObjectUrl(stored);
  if (stored.startsWith("https://")) return stored;
  return "";
}

/**
 * The admin panel's address for a bank-details row's PAN image, or empty when it has none.
 * The address stays valid while the page is cached; each load mints a fresh signed link.
 */
export function adminKycImagePath(kind: KycOwnerKind, bankDetailsId: number, stored: string, updatedAt: Date | null): string {
  if (!isPrivateKey(stored) && !stored.startsWith("https://")) return "";
  const section = kind === "teacher" ? "bank-details" : "student-bank-details";
  return `/_api/admin/${section}/pan-image?id=${bankDetailsId}&v=${updatedAt ? updatedAt.getTime() : 0}`;
}

/** Redirects an image request to a signed link for the stored PAN image. */
export async function kycImageRedirect(stored: string | null | undefined): Promise<Response> {
  const link = await kycImageUrl(stored);
  if (!link) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response("Redirecting", {
    status: 302,
    headers: {
      Location: link,
      "Cache-Control": "private, max-age=300",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * Resolves the PAN image a bank-details form submitted to the value to store: a data URI is
 * uploaded under kyc/; a link must point at the image already on file or at a new
 * upload under the owner's own prefix. Null when the submission cannot be accepted.
 */
export async function resolveKycImage(
  kind: KycOwnerKind,
  ownerId: number,
  submitted: string,
  stored: string | null | undefined
): Promise<string | null> {
  if (submitted.startsWith("data:")) {
    const matches = submitted.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!matches) return null;
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    if (buffer.length === 0) return null;
    const key = newKycKey(kind, ownerId, contentType.split("/")[1] || "jpg");
    await uploadToR2(key, buffer, contentType);
    return key;
  }

  const key = kycKeyFromValue(submitted);
  if (!key) return null;
  if (stored && kycKeyFromValue(stored) === key) return stored;
  if (key.startsWith(ownerPrefix(kind, ownerId)) && (await r2ObjectExists(key))) return key;
  return null;
}
