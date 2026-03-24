import type { LogLevel } from "@nhalo/config";

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

    write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: targetLevel,
        ...entry
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
