import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, getConfig, resetConfigCache } from "./index";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetConfigCache();
});

describe("config validation", () => {
  it("fails clearly when staging starts without a database url", () => {
    process.env.NODE_ENV = "staging";
    delete process.env.DATABASE_URL;
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/DATABASE_URL is required/);
  });

  it("fails clearly on invalid provider mode values", () => {
    process.env.NODE_ENV = "development";
    process.env.PROVIDER_MODE = "sideways";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/PROVIDER_MODE must be mock, hybrid, or live/);
  });
});
