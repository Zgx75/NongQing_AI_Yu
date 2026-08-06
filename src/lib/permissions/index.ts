import type { Role } from "@prisma/client";

export function canManageFarm(role: Role, userId: string, ownerId: string, memberPermission?: string) {
  return role === "ADMIN" || userId === ownerId || memberPermission === "EDIT";
}

export function canConfirmRecord(role: Role, userId: string, ownerId: string, memberPermission?: string) {
  return role === "ADMIN" || userId === ownerId || (role === "COOPERATIVE" && memberPermission === "CONFIRM");
}

export function canViewFarm(role: Role, userId: string, ownerId: string, isMember: boolean) {
  return role === "ADMIN" || userId === ownerId || isMember;
}
