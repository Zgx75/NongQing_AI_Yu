import { fail, ok, AppError } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { getTranscriptionProvider, applyTermCorrections } from "@/lib/transcription";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    rateLimit(`transcription:${user.id}`, 6, 60_000);
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size === 0) throw new AppError("FILE_REQUIRED", "請提供有效的錄音檔。", 422);
    if (file.size > MAX_AUDIO_BYTES) throw new AppError("FILE_TOO_LARGE", "錄音檔不可超過 5MB，請縮短錄音後再試。", 413);
    const result = await getTranscriptionProvider().transcribe(file);
    const terms = await db.agriculturalTerm.findMany({ where: { isActive: true }, select: { incorrectTerm: true, correctedTerm: true } });
    const corrected = applyTermCorrections(result.text, terms);
    return ok({ ...result, ...corrected });
  } catch (error) {
    return fail(error);
  }
}
