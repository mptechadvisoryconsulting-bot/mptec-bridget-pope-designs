"use server";

export async function reserveInventory(projectId: string) {
  return { projectId, reserved: true };
}
