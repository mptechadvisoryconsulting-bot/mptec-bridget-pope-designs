export const roles = ["owner", "admin", "planner", "team_member", "client"] as const;

export type Role = (typeof roles)[number];
