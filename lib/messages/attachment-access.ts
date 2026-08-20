export const messageAttachmentVisibilities = new Set(["client_visible", "client_upload"]);

export function isProjectStoragePath(storagePath: string | null | undefined, projectId: string | null | undefined) {
  if (!storagePath || !projectId) return false;
  const normalized = storagePath.trim();
  if (!normalized || normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/")) {
    return false;
  }
  return normalized.startsWith(`projects/${projectId}/`);
}

export function canUseFileAsMessageAttachment(input: {
  fileProjectId?: string | null;
  conversationProjectId?: string | null;
  visibility?: string | null;
  storagePath?: string | null;
}) {
  return Boolean(
    input.fileProjectId &&
      input.conversationProjectId &&
      input.fileProjectId === input.conversationProjectId &&
      messageAttachmentVisibilities.has(String(input.visibility ?? "")) &&
      isProjectStoragePath(input.storagePath, input.fileProjectId),
  );
}
