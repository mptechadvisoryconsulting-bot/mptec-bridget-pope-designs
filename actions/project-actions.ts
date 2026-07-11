"use server";

export async function createProject(clientId: string) {
  return { projectId: "project_demo", clientId };
}
