import nextConfig from "../../next.config";

describe("baseline security headers", () => {
  it("sets the OWASP-oriented response headers", async () => {
    const headers = await nextConfig.headers?.();
    const values = new Map((headers?.[0].headers ?? []).map((header) => [header.key, header.value]));
    expect(values.get("X-Content-Type-Options")).toBe("nosniff");
    expect(values.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(values.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
