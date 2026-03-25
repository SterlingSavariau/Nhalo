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

  it("fails clearly when ops pagination defaults exceed the configured max", () => {
    process.env.NODE_ENV = "development";
    process.env.OPS_DEFAULT_PAGE_SIZE = "200";
    process.env.OPS_MAX_PAGE_SIZE = "20";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/OPS_DEFAULT_PAGE_SIZE must be less than or equal to OPS_MAX_PAGE_SIZE/);
  });
});
