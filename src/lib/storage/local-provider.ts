import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageProvider } from "./provider";

export class LocalStorageProvider implements StorageProvider {
  private root = path.join(process.cwd(), "uploads");
  async save(file: File) { await mkdir(this.root, { recursive: true }); const ext = path.extname(file.name).toLowerCase(); const key = `${randomUUID()}${ext}`; await writeFile(path.join(this.root, key), Buffer.from(await file.arrayBuffer())); return { key, fileName: file.name, mimeType: file.type, size: file.size }; }
  async delete(key: string) { if (!/^[\w.-]+$/.test(key)) return; await unlink(path.join(this.root, key)).catch(() => undefined); }
}
