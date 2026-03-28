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

  it("fails clearly when internal route guards are enabled in staging without a token", () => {
    process.env.NODE_ENV = "staging";
    process.env.ENABLE_INTERNAL_ROUTE_GUARDS = "true";
    delete process.env.INTERNAL_ROUTE_ACCESS_TOKEN;
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/INTERNAL_ROUTE_ACCESS_TOKEN is required/);
  });

  it("fails clearly when the minimum share token length is too small", () => {
    process.env.NODE_ENV = "development";
    process.env.SHARE_LINK_MIN_TOKEN_LENGTH = "12";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/SHARE_LINK_MIN_TOKEN_LENGTH must be at least 16/);
  });

  it("fails clearly when the default plan tier is invalid", () => {
    process.env.NODE_ENV = "development";
    process.env.DEFAULT_PLAN_TIER = "gold";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/DEFAULT_PLAN_TIER must be free_demo, pilot, partner, or internal/);
  });

  it("applies safer staging defaults for public sharing and demo features", () => {
    process.env.NODE_ENV = "staging";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nhalo";
    resetConfigCache();

    const config = getConfig();

    expect(config.runtimeEnvironment).toBe("staging");
    expect(config.deployment.profile).toBe("staging_pilot");
    expect(config.deployment.environmentBehavior.productionLike).toBe(true);
    expect(config.security.publicSharedViewsEnabled).toBe(false);
    expect(config.security.publicSharedShortlistsEnabled).toBe(false);
    expect(config.validation.demoScenariosEnabled).toBe(false);
  });

  it("uses local-friendly runtime defaults when no explicit runtime environment is provided", () => {
    process.env.NODE_ENV = "development";
    delete process.env.RUNTIME_ENVIRONMENT;
    resetConfigCache();

    const config = getConfig();

    expect(config.runtimeEnvironment).toBe("local");
    expect(config.deployment.profile).toBe("local_demo");
    expect(config.deployment.environmentBehavior.strictRateLimitsDefault).toBe(false);
    expect(config.validation.demoScenariosEnabled).toBe(true);
  });

  it("allows explicit environment profile overrides", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV_PROFILE = "local_dev";
    resetConfigCache();

    const config = getConfig();

    expect(config.deployment.profile).toBe("local_dev");
    expect(config.validation.demoScenariosEnabled).toBe(false);
    expect(config.security.publicSharedViewsEnabled).toBe(true);
  });

  it("fails clearly on invalid environment profiles", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV_PROFILE = "launch_party";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/APP_ENV_PROFILE must be local_demo, local_dev, staging_pilot, or production_pilot/);
  });

  it("fails clearly when production-like public sharing is enabled without internal guards", () => {
    process.env.NODE_ENV = "staging";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nhalo";
    process.env.ENABLE_PUBLIC_SHARED_VIEWS = "true";
    process.env.ENABLE_INTERNAL_ROUTE_GUARDS = "false";
    resetConfigCache();

    expect(() => getConfig()).toThrowError(ConfigError);
    expect(() => getConfig()).toThrow(/ENABLE_INTERNAL_ROUTE_GUARDS must be true/);
  });
});
