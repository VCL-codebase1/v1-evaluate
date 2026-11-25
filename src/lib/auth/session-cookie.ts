export const SESSION_ONLY_COOKIE = "v11_session_only";

export function authCookieOptions<T extends { maxAge?: number; expires?: Date }>(options: T, sessionOnly: boolean) {
  if (!sessionOnly || options.maxAge === 0) return options;
  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}
