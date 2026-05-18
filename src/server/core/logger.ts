// src/server/core/logger.ts

type LogLevel = 'info' | 'warn' | 'error';

export function log(
  module: string,
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    module,
    level,
    message,
  };

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        entry[key] = value;
      }
    }
  }

  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}
