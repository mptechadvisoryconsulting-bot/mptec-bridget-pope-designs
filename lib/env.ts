export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(`${name} is required`);
  }

  return value;
}

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof ConfigurationError) {
    return error.message;
  }

  return "The request could not be completed.";
}
