import { resolveDatabaseConnectionUrl } from "@/lib/db/connection-url";

describe("database connection mode", () => {
  it("uses session pooling with a shared Supabase pooler", () => {
    const input = "postgresql://postgres.project:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres";
    expect(resolveDatabaseConnectionUrl(input)).toBe(
      "postgresql://postgres.project:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("preserves other database URLs", () => {
    const input = "postgres://postgres:secret@localhost:5432/app";
    expect(resolveDatabaseConnectionUrl(input)).toBe(input);
  });
});
