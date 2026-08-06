import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public fields: Record<string, string[]> = {}) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    const fields = error.flatten().fieldErrors as Record<string, string[]>;
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "請確認輸入資料。", fields } }, { status: 422 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ success: false, error: { code: error.code, message: error.message, fields: error.fields } }, { status: error.status });
  }
  console.error("Unhandled server error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "系統暫時無法處理，請稍後再試。", fields: {} } }, { status: 500 });
}

export async function parseJson(request: Request) {
  try { return await request.json(); }
  catch { throw new AppError("INVALID_JSON", "請提供有效的資料格式。", 400); }
}
