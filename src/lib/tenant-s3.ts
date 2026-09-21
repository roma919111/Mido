import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "tenant-uploads");

export type TenantUploadResult = {
  storage: "s3" | "local";
  storageKey: string;
};

function s3Configured(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET?.trim() &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

function s3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION?.trim() || "eu-central-1",
  });
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.bin";
}

const ALLOWED_EXT = new Set([
  ".sql",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".csv",
  ".json",
  ".zip",
  ".gz",
  ".bak",
]);

export function assertAllowedDbUpload(fileName: string, sizeBytes: number): void {
  if (sizeBytes <= 0) throw new Error("ملف فارغ");
  const max = Number(process.env.TENANT_UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
  if (sizeBytes > max) {
    throw new Error(`حجم الملف يتجاوز ${Math.round(max / (1024 * 1024))}MB`);
  }
  const lower = fileName.toLowerCase();
  const ext = lower.includes(".") ? `.${lower.split(".").pop()}` : "";
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("نوع الملف غير مسموح — استخدم sql, db, sqlite, csv, json, zip");
  }
}

export async function storeTenantDbFile(input: {
  tenantSlug: string;
  tenantId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<TenantUploadResult> {
  assertAllowedDbUpload(input.fileName, input.body.length);

  const uploadId = randomUUID();
  const safe = safeFileName(input.fileName);
  const key = `${input.tenantSlug}/uploads/${uploadId}-${safe}`;

  if (s3Configured()) {
    const bucket = process.env.AWS_S3_BUCKET!.trim();
    const prefix = (process.env.AWS_S3_PREFIX || "tenants/").replace(/^\/*/, "").replace(/\/*$/, "");
    const objectKey = `${prefix}/${key}`;
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType || "application/octet-stream",
        ServerSideEncryption: "AES256",
      }),
    );
    return { storage: "s3", storageKey: objectKey };
  }

  const localPath = path.join(LOCAL_ROOT, input.tenantId, `${uploadId}-${safe}`);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, input.body);
  return { storage: "local", storageKey: localPath };
}

export function tenantStorageMode(): "s3" | "local" {
  return s3Configured() ? "s3" : "local";
}
