const portalDomain = "portal.bridgetpopedesigns.com";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function portalEmailForUsername(username: string) {
  return `${normalizeUsername(username)}@${portalDomain}`;
}

export function credentialToEmail(credential: string) {
  const value = credential.trim();
  return value.includes("@") ? value.toLowerCase() : portalEmailForUsername(value);
}
