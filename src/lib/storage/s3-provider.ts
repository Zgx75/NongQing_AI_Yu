import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError } from "@/lib/api";
import type { StorageProvider } from "./provider";

function settings() {
  const endpoint = process.env.S3_ENDPOINT, region = process.env.S3_REGION, bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY, secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) throw new AppError("STORAGE_NOT_CONFIGURED", "S3 相容儲存尚未完成環境變數設定。", 503);
  return { bucket, client: new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }) };
}

export class S3StorageProvider implements StorageProvider {
  async save(file: File) { const { client, bucket } = settings(); const key = `uploads/${randomUUID()}${path.extname(file.name).toLowerCase()}`; await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type })); return { key, fileName: file.name, mimeType: file.type, size: file.size }; }
  async delete(key: string) { const { client, bucket } = settings(); await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }
}
