import { describe, expect, it } from "vitest";
import { resolveApiErrorOrigin } from "./api";

describe("resolveApiErrorOrigin", () => {
  it("reports the proxy target during local dev when no explicit API URL is set", () => {
    expect(resolveApiErrorOrigin({ DEV: true })).toBe("http://localhost:3000");
  });

  it("prefers the configured Vite API URL during local dev", () => {
    expect(resolveApiErrorOrigin({ DEV: true, VITE_API_URL: " http://localhost:4000 " })).toBe(
      "http://localhost:4000"
    );
  });

  it("uses the default backend origin in production when no API URL is configured", () => {
    expect(resolveApiErrorOrigin({ DEV: false }, "https://app.nhalo.com")).toBe("http://localhost:3000");
  });
});
