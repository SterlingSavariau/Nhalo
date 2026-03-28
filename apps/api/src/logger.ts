import { getConfig, type LogLevel } from "@nhalo/config";

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  endpoint?: string;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  details?: unknown;
}

const REDACTED = "[REDACTED]";
const DEFAULT_REDACT_KEYS = new Set([
  "apiKey",
  "authorization",
  "databaseUrl",
  "internalRouteAccessToken",
  "pilotToken",
  "pilotLinkToken",
  "shareId",
  "token",
  "x-nhalo-internal-token"
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (DEFAULT_REDACT_KEYS.has(key)) {
          return [key, REDACTED];
        }
        return [key, redactValue(entry)];
      })
    );
  }

  return value;
}

export interface AppLogger {
  debug(entry: Omit<StructuredLogEntry, "timestamp" | "level">): void;
  info(entry: Omit<StructuredLogEntry, "timestamp" | "level">): void;
  warn(entry: Omit<StructuredLogEntry, "timestamp" | "level">): void;
  error(entry: Omit<StructuredLogEntry, "timestamp" | "level">): void;
  flush(): Promise<void>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return LEVEL_ORDER[targetLevel] >= LEVEL_ORDER[currentLevel];
}

export function createLogger(options?: {
  level?: LogLevel;
  write?(line: string): void;
}): AppLogger {
  const level = options?.level ?? "info";
  const write = options?.write ?? ((line: string) => process.stdout.write(`${line}\n`));

  function log(targetLevel: LogLevel, entry: Omit<StructuredLogEntry, "timestamp" | "level">) {
    if (!shouldLog(level, targetLevel)) {
      return;
    }

    const redactLogs = getConfig().security.redactLogFields;
    write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: targetLevel,
        ...(redactLogs ? (redactValue(entry) as typeof entry) : entry)
      })
    );
  }

  return {
    debug(entry) {
      log("debug", entry);
    },
    info(entry) {
      log("info", entry);
    },
    warn(entry) {
      log("warn", entry);
    },
    error(entry) {
      log("error", entry);
    },
    async flush() {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  };
}
