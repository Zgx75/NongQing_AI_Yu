import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError } from "@/lib/api";
import type { StorageProvider } from "./provider";

function assertConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new AppError("STORAGE_NOT_CONFIGURED", "Vercel Blob is not connected to this project.", 503);
}

export class VercelBlobStorageProvider implements StorageProvider {
  async save(file: File) {
    assertConfigured();
    const pathname = `uploads/${randomUUID()}${path.extname(file.name).toLowerCase()}`;
    const blob = await put(pathname, file, { access: "private", addRandomSuffix: false });
    return { key: blob.url, fileName: file.name, mimeType: file.type, size: file.size };
  }
  async delete(key: string) { assertConfigured(); await del(key); }
}
