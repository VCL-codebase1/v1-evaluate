export function resolveDatabaseConnectionUrl(url: string) {
  const parsed = new URL(url);
  if (/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/i.test(parsed.hostname) && parsed.port === "6543") {
    // Postgres.js pipelines concurrent queries, which the shared Supabase
    // transaction pooler can leave unanswered. Session mode uses the same
    // credentials and supports this driver's pipelining behavior.
    parsed.port = "5432";
    return parsed.toString();
  }
  return url;
}
