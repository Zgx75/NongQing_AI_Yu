import { AppError } from "@/lib/api";
import { getCurrentUser } from "./session";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "請先登入後再繼續。", 401);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AppError("FORBIDDEN", "此功能僅限系統管理員。", 403);
  return user;
}
