export type StoredFile = { key: string; fileName: string; mimeType: string; size: number };
export interface StorageProvider { save(file: File): Promise<StoredFile>; delete(key: string): Promise<void>; }
