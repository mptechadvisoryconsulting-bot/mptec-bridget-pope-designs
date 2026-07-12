"use server";

export async function createProject(clientId: string) {
  return {
    success: false,
    clientId,
    message: "Projects are created through the authenticated admin client setup flow.",
  };
}
