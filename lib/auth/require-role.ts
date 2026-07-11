import type { Role } from "@/lib/constants/roles";

export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new Error("Unauthorized");
  }
}
