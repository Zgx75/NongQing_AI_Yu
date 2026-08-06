import { LocalStorageProvider } from "./local-provider";
import { S3StorageProvider } from "./s3-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";
export const getStorageProvider = () => process.env.UPLOAD_PROVIDER === "s3" ? new S3StorageProvider() : process.env.UPLOAD_PROVIDER === "vercel-blob" ? new VercelBlobStorageProvider() : new LocalStorageProvider();
