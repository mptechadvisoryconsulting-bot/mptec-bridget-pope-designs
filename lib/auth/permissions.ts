import type { Role } from "@/lib/constants/roles";

const permissionsByRole: Record<Role, string[]> = {
  owner: ["*"],
  admin: ["crm:read", "crm:write", "billing:write", "reports:read"],
  planner: ["projects:read", "projects:write", "messages:write"],
  team_member: ["tasks:read", "tasks:write"],
  client: ["portal:read", "messages:write", "payments:write"],
};

export function can(role: Role, permission: string) {
  const permissions = permissionsByRole[role];
  return permissions.includes("*") || permissions.includes(permission);
}
