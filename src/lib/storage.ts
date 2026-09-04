// ============================================================
// UXLLY — Cloudflare R2 Storage
// Upload and manage generated images
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

// ==================== R2 Client ====================

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ==================== Upload Image ====================

export async function uploadImage(
  imageBuffer: Buffer,
  contentType: string = "image/png",
  folder: string = "generated"
): Promise<string> {
  const client = getR2Client();
  const key = `${folder}/${uuid()}.${contentType.split("/")[1] || "png"}`;

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
    })
  );

  // Return the public URL
  const publicUrl = process.env.R2_PUBLIC_URL;
  return `${publicUrl}/${key}`;
}

// ==================== Upload From URL ====================

export async function uploadFromUrl(
  imageUrl: string,
  folder: string = "generated"
): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";

  return uploadImage(buffer, contentType, folder);
}

// ==================== Delete Image ====================

export async function deleteImage(key: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}

// ==================== Persist Logo ====================
// Tries R2 first (keeps the DB row small, matches the infra
// migration already planned). Falls back to storing the base64
// data URL directly if R2 isn't configured yet, so logo upload
// works today without blocking on the R2 migration.

export async function persistLogo(input: string): Promise<string> {
  const match = input.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) return input; // already a URL, nothing to do

  const [, contentType, data] = match;
  try {
    const buffer = Buffer.from(data, "base64");
    return await uploadImage(buffer, contentType, "logos");
  } catch (err) {
    console.error("[STORAGE] R2 logo upload failed, storing base64 directly:", err);
    return input;
  }
}
