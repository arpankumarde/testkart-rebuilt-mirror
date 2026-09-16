import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./_publicConfigs";

let s3Client: S3Client | null = null;

/**
 * Creates and caches an S3Client configured for Cloudflare R2
 */
export const getR2Client = (): S3Client => {
  if (!s3Client) {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error("Missing R2 credentials: R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is not set.");
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

/**
 * Generates a presigned URL for direct client-side uploads via PUT. Given contentLength, the
 * signature also covers the Content-Type and Content-Length headers, so the PUT must match both.
 */
export const getPresignedUploadUrl = async (
  key: string,
  contentType: string,
  expiresIn: number = 3600,
  contentLength?: number
): Promise<string> => {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength === undefined ? {} : { ContentLength: contentLength }),
  });

  return getSignedUrl(client, command, {
    expiresIn,
    ...(contentLength === undefined ? {} : { signableHeaders: new Set(["content-type", "content-length"]) }),
  });
};

/**
 * Generates a presigned URL for secure downloads (if bypassing public URL is needed)
 */
export const getSignedDownloadUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
};

/**
 * Direct backend upload to R2. contentDisposition, when given, is stored with the object and served with it.
 */
export const uploadToR2 = async (
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string,
  contentDisposition?: string
): Promise<void> => {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
  });

  await client.send(command);
};

/**
 * Deletes an object from R2 by key. Gracefully ignores if not found.
 */
export const deleteFromR2 = async (key: string): Promise<void> => {
  try {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    await client.send(command);
  } catch (error) {
    console.error(`Failed to delete object ${key} from R2:`, error);
    // Log but do not throw to allow cleanup workflows to proceed gracefully
  }
};

/**
 * Constructs the public URL for a given object key based on the configured custom domain
 */
export const getPublicUrl = (key: string): string => {
  return `https://${R2_PUBLIC_URL}/${key}`;
};

/**
 * Copies an object within the same R2 bucket from sourceKey to destinationKey
 * using R2's native S3-compatible COPY operation (server-side, no bytes
 * pass through our own backend). Each path segment of the source key is
 * URI-encoded individually so slashes in the key are preserved.
 */
export const copyR2Object = async (sourceKey: string, destinationKey: string): Promise<void> => {
  const client = getR2Client();
  const encodedSourceKey = sourceKey.split("/").map(encodeURIComponent).join("/");
  const command = new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    CopySource: `${R2_BUCKET_NAME}/${encodedSourceKey}`,
    Key: destinationKey,
  });

  await client.send(command);
};

/**
 * Checks whether an object exists at the given key.
 */
export const r2ObjectExists = async (key: string): Promise<boolean> => {
  try {
    const client = getR2Client();
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates a multipart upload session on R2, returning the uploadId
 */
export const createMultipartUpload = async (key: string, contentType: string): Promise<string> => {
  const client = getR2Client();
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const response = await client.send(command);
  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload. No UploadId returned from S3.");
  }
  return response.UploadId;
};

/**
 * Generates a presigned URL for uploading a specific part in a multipart upload
 */
export const getPresignedPartUrl = async (key: string, uploadId: string, partNumber: number, expiresIn: number = 3600): Promise<string> => {
  const client = getR2Client();
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(client, command, { expiresIn });
};

/**
 * Completes a multipart upload by sending the part list
 */
export const completeMultipartUpload = async (key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]): Promise<void> => {
  const client = getR2Client();
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await client.send(command);
};

/**
 * Lists the uploaded parts of a multipart upload
 */
export const listMultipartParts = async (key: string, uploadId: string): Promise<{ PartNumber: number; ETag: string }[]> => {
  const client = getR2Client();
  const allParts: { PartNumber: number; ETag: string }[] = [];
    let partNumberMarker: string | undefined;
  
  // ListParts is paginated, so we need to loop
  while (true) {
    const command = new ListPartsCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      ...(partNumberMarker ? { PartNumberMarker: partNumberMarker } : {}),
    });
    const response = await client.send(command);
    
    if (response.Parts) {
      for (const part of response.Parts) {
        if (part.PartNumber != null && part.ETag) {
          allParts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
        }
      }
    }
    
    if (!response.IsTruncated) break;
    partNumberMarker = response.NextPartNumberMarker;
  }
  
  return allParts;
};

/**
 * Aborts a multipart upload
 */
export const abortMultipartUpload = async (key: string, uploadId: string): Promise<void> => {
  try {
    const client = getR2Client();
    const command = new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    });
    
    await client.send(command);
  } catch (error) {
    console.error(`Failed to abort multipart upload for key ${key}, uploadId ${uploadId}:`, error);
    // Log but do not throw to allow cleanup workflows to proceed gracefully
  }
};