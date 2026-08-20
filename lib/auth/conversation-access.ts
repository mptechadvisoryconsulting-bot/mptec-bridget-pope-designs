export type ConversationAccessContext = {
  role?: string | null;
  profileId: string;
  clientProfileId?: string | null;
  assignedAdminId?: string | null;
};

const ADMIN_ROLES = new Set(["owner", "admin"]);

/**
 * A project conversation is visible only to an owner/admin, the client profile
 * attached to the conversation, or the admin assigned to that project.
 */
export function canAccessConversation({
  role,
  profileId,
  clientProfileId,
  assignedAdminId,
}: ConversationAccessContext) {
  return ADMIN_ROLES.has(role ?? "") || clientProfileId === profileId || assignedAdminId === profileId;
}
