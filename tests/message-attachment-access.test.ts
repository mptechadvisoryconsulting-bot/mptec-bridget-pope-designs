import { describe, expect, it } from "vitest";
import { canUseFileAsMessageAttachment, isProjectStoragePath } from "@/lib/messages/attachment-access";

describe("message attachment access", () => {
  it("allows a client-visible project file from the same project", () => {
    expect(
      canUseFileAsMessageAttachment({
        fileProjectId: "project-a",
        conversationProjectId: "project-a",
        visibility: "client_visible",
        storagePath: "projects/project-a/mood-board.pdf",
      }),
    ).toBe(true);
  });

  it("allows a client upload from the same project", () => {
    expect(
      canUseFileAsMessageAttachment({
        fileProjectId: "project-a",
        conversationProjectId: "project-a",
        visibility: "client_upload",
        storagePath: "projects/project-a/photo.jpg",
      }),
    ).toBe(true);
  });

  it("blocks a file from another project", () => {
    expect(
      canUseFileAsMessageAttachment({
        fileProjectId: "project-b",
        conversationProjectId: "project-a",
        visibility: "client_visible",
        storagePath: "projects/project-b/private.pdf",
      }),
    ).toBe(false);
  });

  it("blocks admin-private files from message attachments", () => {
    expect(
      canUseFileAsMessageAttachment({
        fileProjectId: "project-a",
        conversationProjectId: "project-a",
        visibility: "private_admin",
        storagePath: "projects/project-a/internal.pdf",
      }),
    ).toBe(false);
  });

  it("rejects external or malformed project paths", () => {
    expect(isProjectStoragePath("https://example.com/file.pdf", "project-a")).toBe(false);
    expect(isProjectStoragePath("projects/project-b/file.pdf", "project-a")).toBe(false);
    expect(isProjectStoragePath("projects/project-a/file.pdf", "project-a")).toBe(true);
  });
});
